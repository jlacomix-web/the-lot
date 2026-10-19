// Load test with real WebSocket bots against a running server. Run inside the game container:
//   docker compose exec game node scripts/loadtest.mjs <bots> <seconds> --yes
// It creates temporary accounts (loadbot-N@example.invalid), connects them, and deletes them afterwards.
// 60% of bots sit in random seats and idle (like an audience); 40% walk around, chat and emote.
import WebSocket from 'ws';
import pg from 'pg';
import { newToken, hashToken } from '../src/security.js';
import { SEATS, WORLD } from '../src/world.js';

const bots = Number(process.argv[2] || 50), secs = Number(process.argv[3] || 30);
if (!process.argv.includes('--yes')) { console.error('Usage: node scripts/loadtest.mjs <bots> <seconds> --yes   (creates and deletes temporary accounts)'); process.exit(1); }
const WS = process.env.WS_URL || 'ws://localhost:3000/ws', ORIGIN = process.env.PUBLIC_URL || 'https://localhost', HEALTH = WS.replace('ws://', 'http://').replace('/ws', '/healthz');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const seatList = [...SEATS.values()];
const stats = { open: 0, failed: 0, msgs: 0, bytes: 0, snaps: 0, entries: 0 };
const health = async () => { try { return await (await fetch(HEALTH)).json(); } catch { return {}; } };
const rnd = (a, b) => a + Math.random() * (b - a);

async function makeBots() {
  const out = [];
  for (let i = 0; i < bots; i++) {
    const u = (await pool.query(`insert into users (email, password_hash, display_name, email_verified) values ($1, 'x', $2, true) returning id`, [`loadbot-${i}@example.invalid`, `bot${i}`])).rows[0];
    await pool.query(`insert into avatars (user_id, data) values ($1, $2)`, [u.id, { v: 1, body: 1, skin: i % 8, hairStyle: i % 6, hairColor: i % 8, pattern: i % 4, shirt: i % 8, shirt2: (i + 3) % 8, pants: i % 6, shoes: i % 6, hat: i % 5, glasses: i % 3 }]);
    const token = newToken();
    await pool.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '1 day')`, [hashToken(token), u.id]);
    out.push(token);
  }
  return out;
}

function runBot(token, i) {
  const ws = new WebSocket(WS, { headers: { Cookie: `sid=${token}`, Origin: ORIGIN } });
  const sitter = i % 10 < 6, seat = sitter ? [...SEATS][Math.floor(Math.random() * SEATS.size)] : null;
  let x = sitter ? seat[1].x : rnd(-60, 100), z = sitter ? seat[1].z : rnd(-90, 10), tx = x, tz = z, yaw = 0, timer;
  ws.on('open', () => {
    stats.open++;
    if (sitter) { ws.send(JSON.stringify({ type: 'state', x, y: seat[1].gy, z, yaw: -1.57, mv: 0, sit: 0 })); setTimeout(() => ws.send(JSON.stringify({ type: 'sit', seat: seat[0] })), 300); }
    timer = setInterval(() => {
      if (ws.readyState !== 1) return;
      if (sitter) ws.send(JSON.stringify({ type: 'state', x, y: seat[1].gy, z, yaw: -1.57, mv: 0, sit: 1 }));
      else {
        if (Math.hypot(tx - x, tz - z) < 1) { tx = rnd(-60, 100); tz = rnd(-90, 10); }
        const d = Math.hypot(tx - x, tz - z), step = Math.min(d, 0.4); x += (tx - x) / d * step; z += (tz - z) / d * step; yaw = Math.atan2(-(tx - x), -(tz - z));
        ws.send(JSON.stringify({ type: 'state', x: +x.toFixed(2), y: 0, z: +z.toFixed(2), yaw: +yaw.toFixed(2), mv: 1, sit: 0 }));
        if (Math.random() < 0.003) ws.send(JSON.stringify({ type: 'chat', text: 'hello from bot ' + i }));
        if (Math.random() < 0.003) ws.send(JSON.stringify({ type: 'emote', e: Math.floor(Math.random() * 5) }));
      }
    }, 100);
  });
  ws.on('message', (raw) => { stats.msgs++; stats.bytes += raw.length; try { const m = JSON.parse(raw); if (m.type === 'snap') { stats.snaps++; stats.entries += m.p.length; } } catch { /* ignore */ } });
  ws.on('error', () => { stats.failed++; });
  ws.on('close', () => clearInterval(timer));
  return ws;
}

const tokens = await makeBots();
console.log(`created ${tokens.length} bots; before:`, await health());
const sockets = [];
for (let i = 0; i < tokens.length; i++) { sockets.push(runBot(tokens[i], i)); await new Promise((r) => setTimeout(r, 25)); }
await new Promise((r) => setTimeout(r, 3000));
const base = { ...stats }; const t0 = Date.now();
await new Promise((r) => setTimeout(r, secs * 1000));
const el = (Date.now() - t0) / 1000, mid = await health();
console.log(`connected ${stats.open}/${bots}, errors ${stats.failed}`);
console.log(`per bot: ${((stats.bytes - base.bytes) / el / bots / 1024).toFixed(1)} KB/s in, ${((stats.snaps - base.snaps) / el / bots).toFixed(1)} snapshots/s, ${((stats.entries - base.entries) / Math.max(1, stats.snaps - base.snaps)).toFixed(1)} players per snapshot`);
console.log(`server total out: ${((stats.bytes - base.bytes) / el / 1048576).toFixed(2)} MB/s (${((stats.bytes - base.bytes) * 8 / el / 1e6).toFixed(1)} Mbit/s)`);
console.log('server during test:', mid);
sockets.forEach((w) => w.close());
await new Promise((r) => setTimeout(r, 500));
await pool.query(`delete from users where email like 'loadbot-%@example.invalid'`);
await pool.end();
console.log('cleaned up test accounts');
