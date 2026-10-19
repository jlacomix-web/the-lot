// Live game: presence, movement checks, seat claims, emotes, chat, mute, reports and moderation.
// `q` is the database query function.
import { WORLD, SEATS } from './world.js';

export const L = {
  tickMs: 100, maxPlayers: 200, msgPerSec: 30,
  maxSpeed: 14, slack: 3, grace: 25,          // metres/second, extra metres allowed, extra after standing up
  viewRadius: 140, farRadius: 70, heartbeatMs: 2000, // players beyond farRadius update at half rate; idle players resend every heartbeat
  seatReach: 3.6, seatDy: 2.5,
  chatMax: 140, chatBurst: 5, chatRefillMs: 1000, chatLogMax: 300,
  emotes: 5, emoteGapMs: 1200, cmdGapMs: 500, reportMax: 3, reportWindowMs: 600000,
};
const RANK = { player: 0, moderator: 1, admin: 2 };
const B = WORLD.bounds;
const clamp = (v, [lo, hi]) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const r2 = (v) => Math.round(v * 100) / 100;

export function createGame(q) {
  const players = new Map(), byUser = new Map(), seatOwner = new Map(), chatLog = [];
  let nextId = 1, tickNo = 0;
  const send = (p, obj) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(obj)); };
  const broadcast = (obj, except) => { const s = JSON.stringify(obj); for (const p of players.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(s); };
  const info = (p) => ({ id: p.id, name: p.name, avatar: p.avatar });
  const findUser = async (name) => (await q('select id, display_name, role from users where lower(display_name) = lower($1)', [String(name).slice(0, 20)])).rows[0];
  const audit = (p, action, target, detail) => q('insert into audit_log (actor_id, action, target_id, detail) values ($1, $2, $3, $4)', [p.userId, action, target ? target.id : null, detail || null]).catch(() => {});
  function releaseSeat(p) {
    if (!p.seat) return;
    if (seatOwner.get(p.seat) === p.id) { seatOwner.delete(p.seat); broadcast({ type: 'seat', seat: p.seat, player: null }); }
    p.seat = null;
  }

  // ---- slash commands (mute, report, and moderation) ----
  async function command(p, line, t) {
    const m = /^\/?(\S+)\s*(.*)$/.exec(String(line).trim());
    if (!m) return;
    const cmd = m[1].toLowerCase(), rest = m[2].trim().slice(0, 300);
    const say = (text) => send(p, { type: 'sys', text });
    const need = (role) => RANK[p.role] >= RANK[role] || (say('You do not have permission for that.'), false);
    const split = () => { const i = rest.indexOf(' '); return i < 0 ? [rest, ''] : [rest.slice(0, i), rest.slice(i + 1).trim()]; };
    if (t - p.cmdAt < L.cmdGapMs) return;
    p.cmdAt = t;
    try {
      switch (cmd) {
        case 'mute': case 'unmute': {
          if (!rest) return say(`Usage: /${cmd} name`);
          const u = await findUser(rest);
          if (!u || u.id === p.userId) return say('No such player.');
          if (cmd === 'mute') { await q('insert into mutes (muter_id, muted_id) values ($1, $2) on conflict do nothing', [p.userId, u.id]); p.muted.add(u.id); say(`Muted ${u.display_name}.`); }
          else { await q('delete from mutes where muter_id = $1 and muted_id = $2', [p.userId, u.id]); p.muted.delete(u.id); say(`Unmuted ${u.display_name}.`); }
          return;
        }
        case 'report': {
          const [name, reason] = split();
          if (!name || !reason) return say('Usage: /report name reason');
          p.reports = (p.reports || []).filter((x) => t - x < L.reportWindowMs);
          if (p.reports.length >= L.reportMax) return say('You have sent too many reports recently.');
          const u = await findUser(name);
          if (!u || u.id === p.userId) return say('No such player.');
          p.reports.push(t);
          const context = [...chatLog.filter((c) => c.userId === u.id).slice(-10), ...chatLog.slice(-5)];
          const r = await q('insert into reports (reporter_id, reported_id, reason, context) values ($1, $2, $3, $4) returning id', [p.userId, u.id, reason.slice(0, 200), JSON.stringify(context)]);
          say('Report sent. Thank you.');
          for (const o of players.values()) if (RANK[o.role] >= 1) send(o, { type: 'sys', text: `New report #${r.rows[0].id}: ${p.name} reported ${u.display_name}: ${reason.slice(0, 120)}` });
          return;
        }
        case 'who': {
          if (!need('moderator')) return;
          const names = [...players.values()].map((o) => o.name);
          return say(`Online (${names.length}): ${names.slice(0, 40).join(', ')}${names.length > 40 ? ', ...' : ''}`);
        }
        case 'reports': {
          if (!need('moderator')) return;
          const r = await q(`select r.id, a.display_name as reporter, b.display_name as reported, r.reason from reports r
                             left join users a on a.id = r.reporter_id left join users b on b.id = r.reported_id where not r.handled order by r.id desc limit 8`);
          if (!r.rows.length) return say('No open reports.');
          for (const x of r.rows) say(`#${x.id} ${x.reporter} -> ${x.reported}: ${x.reason}`);
          return;
        }
        case 'resolve': {
          if (!need('moderator')) return;
          const id = Number.parseInt(rest, 10);
          if (!Number.isInteger(id)) return say('Usage: /resolve number');
          const r = await q('update reports set handled = true, handled_by = $2 where id = $1 and not handled', [id, p.userId]);
          if (r.rowCount) { audit(p, 'resolve', null, `report ${id}`); say(`Report #${id} resolved.`); } else say('No open report with that number.');
          return;
        }
        case 'announce': {
          if (!need('moderator')) return;
          if (!rest) return say('Usage: /announce text');
          audit(p, 'announce', null, rest.slice(0, 200));
          return broadcast({ type: 'sys', text: `[Announcement] ${rest.slice(0, 200)}` });
        }
        case 'kick': case 'ban': case 'timeout': case 'untimeout': case 'unban': {
          if (!need(cmd === 'ban' || cmd === 'unban' ? 'admin' : 'moderator')) return;
          const [name, args] = split();
          if (!name) return say(`Usage: /${cmd} name${cmd === 'kick' ? ' [reason]' : cmd === 'ban' ? ' hours|perm [reason]' : cmd === 'timeout' ? ' minutes [reason]' : ''}`);
          const u = await findUser(name);
          if (!u) return say('No such player.');
          if (!(RANK[p.role] > RANK[u.role])) return say('You cannot act on someone of equal or higher rank.');
          const target = byUser.get(u.id);
          if (cmd === 'kick') {
            if (!target) return say(`${u.display_name} is not online.`);
            send(target, { type: 'sys', text: `You were removed by a moderator${args ? ': ' + args : '.'}` });
            target.ws.close(4003, 'kicked'); audit(p, 'kick', u, args); return say(`Kicked ${u.display_name}.`);
          }
          if (cmd === 'timeout') {
            const [mins, why] = [Number.parseInt(args, 10), args.replace(/^\S+\s*/, '')];
            if (!(mins >= 1 && mins <= 1440)) return say('Usage: /timeout name minutes(1-1440) [reason]');
            await q(`update users set muted_until = now() + ($2 || ' minutes')::interval where id = $1`, [u.id, String(mins)]);
            if (target) { target.mutedUntil = t + mins * 60000; send(target, { type: 'sys', text: `You are timed out from chat for ${mins} minutes${why ? ': ' + why : '.'}` }); }
            audit(p, 'timeout', u, `${mins}m ${why}`); return say(`${u.display_name} timed out for ${mins} minutes.`);
          }
          if (cmd === 'untimeout') {
            await q('update users set muted_until = null where id = $1', [u.id]);
            if (target) target.mutedUntil = 0;
            audit(p, 'untimeout', u); return say(`Timeout removed for ${u.display_name}.`);
          }
          if (cmd === 'unban') {
            await q('update users set banned_until = null, ban_reason = null where id = $1', [u.id]);
            audit(p, 'unban', u); return say(`Unbanned ${u.display_name}.`);
          }
          // ban
          const [dur, why] = [args.split(/\s+/)[0] || '', args.replace(/^\S+\s*/, '')];
          const hours = dur === 'perm' ? 0 : Number.parseInt(dur, 10);
          if (dur !== 'perm' && !(hours >= 1 && hours <= 8760)) return say('Usage: /ban name hours(1-8760)|perm [reason]');
          await q(dur === 'perm' ? `update users set banned_until = '9999-12-31', ban_reason = $2 where id = $1`
                                 : `update users set banned_until = now() + ($3 || ' hours')::interval, ban_reason = $2 where id = $1`,
            dur === 'perm' ? [u.id, why || null] : [u.id, why || null, String(hours)]);
          await q('delete from sessions where user_id = $1', [u.id]);
          if (target) { send(target, { type: 'sys', text: `Your account was suspended${why ? ': ' + why : '.'}` }); target.ws.close(4001, 'banned'); }
          audit(p, 'ban', u, `${dur} ${why}`); return say(`Banned ${u.display_name} (${dur === 'perm' ? 'permanently' : hours + ' hours'}).`);
        }
        default: return say('Unknown command. Type /help.');
      }
    } catch (e) { console.error('command failed', e); say('Could not do that right now.'); }
  }

  async function onMessage(p, raw) {
    const t = Date.now();
    if (t - p.winStart > 1000) { p.winStart = t; p.count = 0; }
    if (++p.count > L.msgPerSec) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.type !== 'string') return;
    switch (m.type) {
      case 'state': {
        const x = clamp(m.x, B.x), y = clamp(m.y, B.y), z = clamp(m.z, B.z);
        if (x === null || y === null || z === null) return;
        const dt = Math.max(0.05, (t - p.last) / 1000);
        const allowed = L.maxSpeed * dt + (t < p.graceUntil ? L.grace : L.slack);
        if (!p.fresh && Math.hypot(x - p.x, z - p.z) > allowed) return;   // too fast / teleport: ignored
        Object.assign(p, { x, y, z, fresh: false, last: t, yaw: Number.isFinite(m.yaw) ? m.yaw : 0,
          mv: Number.isFinite(m.mv) ? Math.min(2, Math.max(0, m.mv)) : 0, sit: m.sit ? 1 : 0 });
        return;
      }
      case 'sit': {
        const id = String(m.seat || ''), s = SEATS.get(id);
        if (!s) return;
        const owner = seatOwner.get(id);
        if (owner && owner !== p.id) return send(p, { type: 'seatDenied', seat: id, reason: 'taken' });
        if (Math.hypot(p.x - s.x, p.z - s.z) > L.seatReach || Math.abs(p.y - s.gy) > L.seatDy) return send(p, { type: 'seatDenied', seat: id, reason: 'far' });
        if (p.seat && p.seat !== id) releaseSeat(p);
        seatOwner.set(id, p.id); p.seat = id; p.sit = 1;
        broadcast({ type: 'seat', seat: id, player: p.id });
        return;
      }
      case 'stand': releaseSeat(p); p.sit = 0; p.graceUntil = t + 1500; return;
      case 'emote': {
        const e = m.e;
        if (!Number.isInteger(e) || e < 0 || e >= L.emotes || t - p.emoteAt < L.emoteGapMs) return;
        p.emoteAt = t; broadcast({ type: 'emote', id: p.id, e }, p); return;
      }
      case 'chat': {
        const text = String(m.text || '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim().slice(0, L.chatMax);
        if (!text) return;
        if (p.mutedUntil > t) return send(p, { type: 'sys', text: `You are timed out from chat for ${Math.ceil((p.mutedUntil - t) / 60000)} more minute(s).` });
        p.tokens = Math.min(L.chatBurst, p.tokens + (t - p.tokAt) / L.chatRefillMs); p.tokAt = t;
        if (p.tokens < 1) return send(p, { type: 'sys', text: 'You are sending messages too fast.' });
        p.tokens -= 1;
        chatLog.push({ t, userId: p.userId, name: p.name, text }); if (chatLog.length > L.chatLogMax) chatLog.shift();
        const out = JSON.stringify({ type: 'chat', id: p.id, name: p.name, text, t });
        for (const o of players.values()) if ((o === p || !o.muted.has(p.userId)) && o.ws.readyState === 1) o.ws.send(out);
        return;
      }
      case 'cmd': return command(p, m.line, t);
      case 'mute': case 'unmute': return command(p, `/${m.type} ${m.name || ''}`, t);
    }
  }

  function connect(ws, session) {
    if (players.size >= L.maxPlayers) { ws.close(1013, 'server full'); return null; }
    const prev = byUser.get(session.id);
    if (prev) prev.ws.close(4000, 'signed in elsewhere');       // one connection per account
    const now = Date.now();
    const p = { id: nextId++, ws, userId: session.id, name: session.displayName, avatar: session.avatar, role: session.role || 'player',
      mutedUntil: session.mutedUntil || 0, x: WORLD.spawn.x, y: WORLD.spawn.y, z: WORLD.spawn.z, yaw: 0, mv: 0, sit: 0, seat: null, fresh: true,
      last: now, graceUntil: 0, winStart: now, count: 0, tokens: L.chatBurst, tokAt: now, emoteAt: 0, cmdAt: 0, muted: new Set(), sent: new Map() };
    players.set(p.id, p); byUser.set(session.id, p);
    q('select muted_id from mutes where muter_id = $1', [p.userId]).then((r) => r.rows.forEach((x) => p.muted.add(x.muted_id))).catch(() => {});
    send(p, { type: 'welcome', id: p.id, name: p.name, avatar: p.avatar, time: now, players: [...players.values()].filter((o) => o !== p).map(info), seats: [...seatOwner] });
    broadcast({ type: 'join', ...info(p) }, p);
    ws.on('message', (raw) => { onMessage(p, raw).catch(() => {}); });
    const drop = () => {
      if (!players.has(p.id)) return;
      releaseSeat(p); players.delete(p.id);
      if (byUser.get(p.userId) === p) byUser.delete(p.userId);
      for (const o of players.values()) o.sent.delete(p.id);
      broadcast({ type: 'leave', id: p.id });
    };
    ws.on('close', drop); ws.on('error', drop);
    return p;
  }

  // Snapshots only carry players who moved (or a heartbeat every few seconds), and far players at half rate.
  function tick() {
    const list = [...players.values()], R2 = L.viewRadius ** 2, F2 = L.farRadius ** 2, now = Date.now();
    tickNo++;
    for (const o of list) { // build each player's snapshot entry once per tick, not once per viewer
      o.entry = `[${o.id},${r2(o.x)},${r2(o.y)},${r2(o.z)},${r2(o.yaw)},${o.mv},${o.sit}]`;
    }
    for (const p of list) {
      if (p.ws.readyState !== 1) continue;
      const out = [];
      for (const o of list) {
        if (o === p) continue;
        const dx = o.x - p.x, dz = o.z - p.z, d2 = dx * dx + dz * dz;
        if (d2 > R2) { p.sent.delete(o.id); continue; }
        if (d2 > F2 && ((tickNo + o.id) & 1)) continue;
        const prev = p.sent.get(o.id);
        if (prev && prev.k === o.entry && now - prev.t < L.heartbeatMs) continue;
        p.sent.set(o.id, { k: o.entry, t: now });
        out.push(o.entry);
      }
      if (out.length) p.ws.send(`{"type":"snap","p":[${out.join(',')}]}`);
    }
  }
  const timer = setInterval(tick, L.tickMs);
  return { connect, tick, count: () => players.size, stop: () => clearInterval(timer) };
}
