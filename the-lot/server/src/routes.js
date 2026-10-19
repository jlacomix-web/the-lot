import { q } from './db.js';
import { config } from './config.js';
import { hashPassword, verifyPassword, dummyVerify, newToken, hashToken, allow, parseCookies } from './security.js';
import { validateAvatar } from './avatar.js';
import { sendMail } from './mail.js';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{2,19}$/;
const okPw = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 200;
const json = (res, code, obj, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(obj)); };
const ip = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
const cookie = (token, maxAge) => `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${config.secureCookies ? '; Secure' : ''}`;

async function readBody(req) {
  let n = 0; const chunks = [];
  for await (const c of req) { n += c.length; if (n > 8192) throw Object.assign(new Error('Request too large.'), { code: 413 }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { throw Object.assign(new Error('Bad request.'), { code: 400 }); }
}

export async function sessionFromCookie(header) {
  const sid = parseCookies(header).sid;
  if (!sid) return null;
  const r = await q(`select u.id, u.display_name, u.role, u.banned_until, u.muted_until, a.data as avatar
                     from sessions s join users u on u.id = s.user_id left join avatars a on a.user_id = u.id
                     where s.token_hash = $1 and s.expires_at > now()`, [hashToken(sid)]);
  const u = r.rows[0];
  if (!u || (u.banned_until && u.banned_until > new Date())) return null;
  return { id: u.id, displayName: u.display_name, role: u.role, avatar: u.avatar || null, mutedUntil: u.muted_until ? new Date(u.muted_until).getTime() : 0 };
}

async function startSession(req, userId) {
  const t = newToken();
  await q(`insert into sessions (token_hash, user_id, expires_at, user_agent) values ($1, $2, now() + ($3 || ' days')::interval, $4)`,
    [hashToken(t), userId, String(config.sessionDays), String(req.headers['user-agent'] || '').slice(0, 200)]);
  return cookie(t, config.sessionDays * 86400);
}

async function emailToken(userId, kind, interval) {
  const t = newToken();
  await q(`insert into email_tokens (token_hash, user_id, kind, expires_at) values ($1, $2, $3, now() + $4::interval)`, [hashToken(t), userId, kind, interval]);
  return t;
}
async function sendVerify(u) {
  const t = await emailToken(u.id, 'verify', '24 hours');
  await sendMail({ to: u.email, subject: 'Confirm your email for The Lot',
    text: `Hi ${u.display_name},\n\nConfirm your email to finish creating your account:\n${config.publicUrl}/?verify=${t}\n\nThis link expires in 24 hours. If you did not sign up, you can ignore this email.\n` });
}

export async function handleApi(req, res) {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return false;
  try {
    if (req.method !== 'GET') {
      const o = req.headers.origin;
      if (o && o !== config.publicUrl) { json(res, 403, { error: 'Bad origin.' }); return true; }
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) { json(res, 415, { error: 'JSON only.' }); return true; }
    }
    switch (`${req.method} ${url.pathname}`) {
      case 'POST /api/signup': {
        if (!allow('signup:' + ip(req), 8, 3600e3)) { json(res, 429, { error: 'Too many attempts. Try again later.' }); return true; }
        const b = await readBody(req);
        const email = String(b.email || '').trim().toLowerCase(), name = String(b.displayName || '').trim();
        if (!EMAIL.test(email)) { json(res, 400, { error: 'Enter a valid email address.' }); return true; }
        if (!NAME.test(name)) { json(res, 400, { error: 'Display name: 3-20 letters, numbers, spaces, _ or -.' }); return true; }
        if (!okPw(b.password)) { json(res, 400, { error: 'Password must be 10-200 characters.' }); return true; }
        const existing = (await q('select id, email, display_name, email_verified from users where email = $1', [email])).rows[0];
        if (existing) { // same reply either way, so the form cannot be used to discover who has an account
          if (!existing.email_verified && config.requireVerified) await sendVerify(existing);
          json(res, 200, { ok: true, needsVerification: config.requireVerified }); return true;
        }
        if ((await q('select 1 from users where lower(display_name) = lower($1)', [name])).rowCount) { json(res, 409, { error: 'That display name is taken.' }); return true; }
        const u = (await q('insert into users (email, password_hash, display_name, email_verified) values ($1, $2, $3, $4) returning id, email, display_name',
          [email, await hashPassword(b.password), name, !config.requireVerified])).rows[0];
        if (config.requireVerified) await sendVerify(u);
        json(res, 200, { ok: true, needsVerification: config.requireVerified }); return true;
      }
      case 'POST /api/resend': {
        if (!allow('resend:' + ip(req), 5, 3600e3)) { json(res, 429, { error: 'Too many attempts.' }); return true; }
        const email = String((await readBody(req)).email || '').trim().toLowerCase();
        const u = (await q('select id, email, display_name, email_verified from users where email = $1', [email])).rows[0];
        if (u && !u.email_verified) await sendVerify(u);
        json(res, 200, { ok: true }); return true;
      }
      case 'POST /api/verify': {
        const b = await readBody(req);
        const r = await q(`update email_tokens set used_at = now() where token_hash = $1 and kind = 'verify' and used_at is null and expires_at > now() returning user_id`, [hashToken(b.token)]);
        if (!r.rowCount) { json(res, 400, { error: 'This link is invalid or has expired.' }); return true; }
        await q('update users set email_verified = true where id = $1', [r.rows[0].user_id]);
        json(res, 200, { ok: true }); return true;
      }
      case 'POST /api/login': {
        const b = await readBody(req), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
        if (!allow('login-ip:' + ip(req), 30, 900e3) || !allow('login:' + email, 10, 900e3)) { json(res, 429, { error: 'Too many attempts. Try again in a few minutes.' }); return true; }
        const u = (await q('select id, display_name, password_hash, email_verified, banned_until, ban_reason from users where email = $1', [email])).rows[0];
        const ok = u ? await verifyPassword(pw, u.password_hash) : (await dummyVerify(pw), false);
        if (!ok) { json(res, 401, { error: 'Incorrect email or password.' }); return true; }
        if (u.banned_until && u.banned_until > new Date()) { json(res, 403, { error: 'This account is suspended' + (u.ban_reason ? ': ' + u.ban_reason : '.') }); return true; }
        if (config.requireVerified && !u.email_verified) { json(res, 403, { error: 'Please confirm your email first. Check your inbox.', code: 'unverified' }); return true; }
        const sc = await startSession(req, u.id);
        const av = (await q('select data from avatars where user_id = $1', [u.id])).rows[0];
        json(res, 200, { user: { displayName: u.display_name, avatar: av ? av.data : null } }, { 'set-cookie': sc }); return true;
      }
      case 'POST /api/logout': {
        const sid = parseCookies(req.headers.cookie).sid;
        if (sid) await q('delete from sessions where token_hash = $1', [hashToken(sid)]);
        json(res, 200, { ok: true }, { 'set-cookie': cookie('', 0) }); return true;
      }
      case 'GET /api/me': {
        const s = await sessionFromCookie(req.headers.cookie);
        if (!s) json(res, 401, { error: 'Not signed in.' }); else json(res, 200, { user: { displayName: s.displayName, avatar: s.avatar } });
        return true;
      }
      case 'GET /api/auth-check': { // used by the web server to protect the livestream
        const s = await sessionFromCookie(req.headers.cookie);
        res.writeHead(s ? 204 : 401); res.end(); return true;
      }
      case 'PUT /api/avatar': {
        const s = await sessionFromCookie(req.headers.cookie);
        if (!s) { json(res, 401, { error: 'Not signed in.' }); return true; }
        const a = validateAvatar(await readBody(req));
        if (!a) { json(res, 400, { error: 'Invalid avatar.' }); return true; }
        await q(`insert into avatars (user_id, data) values ($1, $2) on conflict (user_id) do update set data = excluded.data, updated_at = now()`, [s.id, a]);
        json(res, 200, { avatar: a }); return true;
      }
      case 'POST /api/password-reset/request': {
        if (!allow('reset:' + ip(req), 5, 3600e3)) { json(res, 429, { error: 'Too many attempts.' }); return true; }
        const email = String((await readBody(req)).email || '').trim().toLowerCase();
        const u = (await q('select id, email, display_name from users where email = $1', [email])).rows[0];
        if (u) { const t = await emailToken(u.id, 'reset', '1 hour');
          await sendMail({ to: u.email, subject: 'Reset your password for The Lot', text: `Hi ${u.display_name},\n\nChoose a new password here:\n${config.publicUrl}/?reset=${t}\n\nThis link expires in 1 hour. If you did not ask for this, ignore this email.\n` }); }
        json(res, 200, { ok: true }); return true;
      }
      case 'POST /api/password-reset/confirm': {
        const b = await readBody(req);
        if (!okPw(b.password)) { json(res, 400, { error: 'Password must be 10-200 characters.' }); return true; }
        const r = await q(`update email_tokens set used_at = now() where token_hash = $1 and kind = 'reset' and used_at is null and expires_at > now() returning user_id`, [hashToken(b.token)]);
        if (!r.rowCount) { json(res, 400, { error: 'This link is invalid or has expired.' }); return true; }
        const id = r.rows[0].user_id;
        await q('update users set password_hash = $1, email_verified = true where id = $2', [await hashPassword(b.password), id]);
        await q('delete from sessions where user_id = $1', [id]); // sign out everywhere
        json(res, 200, { ok: true }); return true;
      }
      default: json(res, 404, { error: 'Not found.' }); return true;
    }
  } catch (e) {
    if (e && (e.code === 413 || e.code === 400)) { json(res, e.code, { error: e.message }); return true; }
    if (e && e.code === '23505') { json(res, 409, { error: 'That display name or email is already in use.' }); return true; }
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Server error. Please try again.' });
    return true;
  }
}
