import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { createGame, L } from '../src/game.js';
import { SEATS, WORLD } from '../src/world.js';

assert.equal(SEATS.size, (20 + 10 + 7 + 4) * 35);
const db = { mutes: [], users: { bob: { id: 'u2', display_name: 'Bob' } } };
const q = async (sql, params) => {
  if (sql.startsWith('select muted_id')) return { rows: [] };
  if (sql.includes('from users')) { const u = db.users[String(params[0]).toLowerCase()]; return { rows: u ? [u] : [] }; }
  db.mutes.push(params); return { rows: [] };
};
const game = createGame(q);
const mk = (id, name) => { const ws = new EventEmitter(); ws.readyState = 1; ws.out = []; ws.send = (s) => ws.out.push(JSON.parse(s)); ws.close = (c) => { ws.readyState = 3; ws.closeCode = c; ws.emit('close'); }; const p = game.connect(ws, { id, displayName: name, avatar: { v: 1 }, role: 'player' }); return { ws, p, say: (o) => ws.emit('message', JSON.stringify(o)), last: (t) => [...ws.out].reverse().find((m) => m.type === t) }; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const a = mk('u1', 'Alice'), b = mk('u2', 'Bob');
assert.equal(a.last('welcome').players.length, 0); assert.equal(b.last('welcome').players.length, 1); assert(a.last('join').name === 'Bob');

// movement: first state accepted anywhere; then speed limit
a.say({ type: 'state', x: 40, y: 0, z: -40, yaw: 1, mv: 1, sit: 0 }); await wait(10);
a.say({ type: 'state', x: 90, y: 0, z: -40, yaw: 1, mv: 1, sit: 0 }); // 50m in 10ms: rejected
game.tick(); const snap = b.last('snap'); assert(snap && snap.p[0][1] === 40, 'teleport rejected, first position kept');
a.say({ type: 'state', x: 1e9, y: 0, z: 0 }); a.say({ type: 'state', x: 'x' }); // garbage ignored

// seats: claim, conflict, too far, release on leave
const [sid, s] = [...SEATS][700];
for (const who of [a, b]) { who.say({ type: 'state', x: s.x, y: s.gy, z: s.z, yaw: 0, mv: 0, sit: 0 }); }
a.p.fresh = false; b.p.fresh = true; b.say({ type: 'state', x: s.x, y: s.gy, z: s.z });
a.p.x = s.x; a.p.z = s.z; a.p.y = s.gy; a.p.last = Date.now();
a.say({ type: 'sit', seat: sid }); assert.equal(b.last('seat').seat, sid); assert.equal(b.last('seat').player, a.p.id);
b.say({ type: 'sit', seat: sid }); assert.equal(b.last('seatDenied').reason, 'taken');
const far = [...SEATS][5]; a.say({ type: 'sit', seat: far[0] }); assert.equal(a.last('seatDenied').reason, 'far');
a.say({ type: 'sit', seat: 'nope' }); a.say({ type: 'sit', seat: '9-9-9' });
a.say({ type: 'stand' }); assert.equal(b.last('seat').player, null);
a.say({ type: 'sit', seat: sid }); a.ws.close(1000); assert.equal(b.last('seat').player, null); assert.equal(b.last('leave').id, a.p.id);

// chat: sanitising, rate limit, mute
const c = mk('u3', 'Cara');
c.say({ type: 'chat', text: '  hi\u202e   there\n ' + 'x'.repeat(300) }); const ch = b.last('chat'); assert(ch.text.startsWith('hi there x') && ch.text.length === L.chatMax && !/\u202e/.test(ch.text));
for (let i = 0; i < 10; i++) c.say({ type: 'chat', text: 'spam' + i });
assert(c.ws.out.some((m) => m.type === 'sys'), 'rate limited'); assert(b.ws.out.filter((m) => m.type === 'chat' && m.text.startsWith('spam')).length <= L.chatBurst);
b.say({ type: 'mute', name: 'cara' }); await wait(20); // 'cara' is not in the fake db -> no such player
assert.equal(b.last('sys').text, 'No such player.');
db.users.cara = { id: 'u3', display_name: 'Cara' }; await wait(L.cmdGapMs + 20); b.say({ type: 'mute', name: 'CARA' }); await wait(20);
assert.equal(b.last('sys').text, 'Muted Cara.'); const cnt = () => b.ws.out.filter((x) => x.type === 'chat').length, n = cnt(); c.say({ type: 'chat', text: 'after mute' }); await wait(1100);
c.say({ type: 'chat', text: 'after mute 2' }); assert.equal(cnt(), n, 'muted player no longer reaches Bob'); assert(c.last('chat').text === 'after mute 2');

// emotes
c.say({ type: 'emote', e: 2 }); assert.equal(b.last('emote').e, 2); const em = () => b.ws.out.filter((x) => x.type === 'emote').length, m = em(); c.say({ type: 'emote', e: 2 }); c.say({ type: 'emote', e: 99 }); assert.equal(em(), m);

// second login replaces the first
const c2 = mk('u3', 'Cara'); assert.equal(c.ws.closeCode, 4000); assert.equal(game.count(), 2);
game.stop(); console.log('GAME_OK');
