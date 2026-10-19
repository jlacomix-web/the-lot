import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { createGame, L } from '../src/game.js';

const users = { alice: { id: 'u1', display_name: 'Alice', role: 'player' }, bob: { id: 'u2', display_name: 'Bob', role: 'player' },
  mo: { id: 'u8', display_name: 'Mo', role: 'moderator' }, ada: { id: 'u9', display_name: 'Ada', role: 'admin' } };
const sql = [];
const q = async (text, params = []) => {
  sql.push([text, params]);
  if (text.includes('from users where lower(display_name)')) { const u = users[String(params[0]).toLowerCase()]; return { rows: u ? [u] : [] }; }
  if (text.includes('insert into reports')) return { rows: [{ id: 7 }] };
  if (text.includes('from reports r')) return { rows: [{ id: 7, reporter: 'Alice', reported: 'Bob', reason: 'spam' }] };
  if (text.includes('update reports')) return { rows: [], rowCount: 1 };
  return { rows: [], rowCount: 0 };
};
const game = createGame(q);
const mk = (u) => { const ws = new EventEmitter(); ws.readyState = 1; ws.out = []; ws.send = (s) => ws.out.push(JSON.parse(s)); ws.close = (c) => { ws.readyState = 3; ws.code = c; ws.emit('close'); };
  game.connect(ws, { id: u.id, displayName: u.display_name, avatar: { v: 1 }, role: u.role }); let gap = 0;
  return { ws, cmd: async (line) => { ws.emit('message', JSON.stringify({ type: 'cmd', line })); await new Promise((r) => setTimeout(r, 15)); }, last: (t) => [...ws.out].reverse().find((m) => m.type === t), sys: () => [...ws.out].reverse().find((m) => m.type === 'sys')?.text };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const a = mk(users.alice), b = mk(users.bob), mo = mk(users.mo), ada = mk(users.ada);

// reports reach moderators and save chat context
b.ws.emit('message', JSON.stringify({ type: 'chat', text: 'buy my stuff' }));
await a.cmd('/report bob spamming links'); assert.equal(a.sys(), 'Report sent. Thank you.');
assert.match(mo.sys(), /New report #7: Alice reported Bob: spamming links/); assert(!/New report/.test(b.sys() || ''));
const ins = sql.find(([t]) => t.includes('insert into reports')); assert(JSON.parse(ins[1][3]).some((c) => c.text === 'buy my stuff'), 'chat context saved');
await wait(L.cmdGapMs); await a.cmd('/report bob again one'); await wait(L.cmdGapMs); await a.cmd('/report bob again two'); await wait(L.cmdGapMs); await a.cmd('/report bob again three');
assert.equal(a.sys(), 'You have sent too many reports recently.');

// permissions and rank
await wait(L.cmdGapMs); await a.cmd('/kick bob'); assert.equal(a.sys(), 'You do not have permission for that.');
await wait(L.cmdGapMs); await mo.cmd('/kick ada'); assert.equal(mo.sys(), 'You cannot act on someone of equal or higher rank.');
await wait(L.cmdGapMs); await mo.cmd('/ban bob perm'); assert.equal(mo.sys(), 'You do not have permission for that.');
await wait(L.cmdGapMs); await mo.cmd('/reports'); assert.match(mo.sys(), /#7 Alice -> Bob: spam/);
await wait(L.cmdGapMs); await mo.cmd('/who'); assert.match(mo.sys(), /Online \(4\)/);

// timeout blocks chat, untimeout restores it
await wait(L.cmdGapMs); await mo.cmd('/timeout bob 5 cool off'); assert.match(b.sys(), /timed out from chat for 5 minutes: cool off/);
const chats = () => a.ws.out.filter((m) => m.type === 'chat').length, n = chats();
b.ws.emit('message', JSON.stringify({ type: 'chat', text: 'still here' })); assert.equal(chats(), n); assert.match(b.sys(), /timed out from chat/);
await wait(L.cmdGapMs); await mo.cmd('/untimeout bob'); b.ws.emit('message', JSON.stringify({ type: 'chat', text: 'back' })); assert.equal(chats(), n + 1);

// announce, kick
await wait(L.cmdGapMs); await mo.cmd('/announce show starts in 5'); assert.equal(a.sys(), '[Announcement] show starts in 5');
await wait(L.cmdGapMs); await mo.cmd('/kick bob too loud'); assert.equal(b.ws.code, 4003); assert.match(b.sys(), /removed by a moderator: too loud/);

// ban (admin): database updated, sessions deleted, player disconnected
await wait(L.cmdGapMs); await ada.cmd('/ban alice 24 harassment'); assert.equal(a.ws.code, 4001);
assert(sql.some(([t, p]) => t.includes('banned_until = now()') && p[1] === 'harassment' && p[2] === '24'));
assert(sql.some(([t, p]) => t.includes('delete from sessions') && p[0] === 'u1'));
assert(sql.some(([t, p]) => t.includes('insert into audit_log') && p[1] === 'ban'));
await wait(L.cmdGapMs); await ada.cmd('/ban mo perm'); assert(sql.some(([t]) => t.includes("'9999-12-31'")));
await wait(L.cmdGapMs); await ada.cmd('/unban alice'); assert.equal(ada.sys(), 'Unbanned Alice.');
await wait(L.cmdGapMs); await ada.cmd('/nonsense'); assert.equal(ada.sys(), 'Unknown command. Type /help.');
game.stop(); console.log('MODERATION_OK');
