// Server-side cost of snapshots with simulated players (no network, no database): `npm run bench`.
import { EventEmitter } from 'node:events';
import { createGame, L } from '../src/game.js';
import { SEATS } from '../src/world.js';

function scenario(n, seatedShare) {
  const game = createGame(async () => ({ rows: [] })); game.stop();
  const bytes = { v: 0 }, seats = [...SEATS.values()], bots = [];
  for (let i = 0; i < n; i++) {
    const ws = new EventEmitter(); ws.readyState = 1; ws.send = (s) => { bytes.v += s.length; }; ws.close = () => {};
    const p = game.connect(ws, { id: 'u' + i, displayName: 'p' + i, avatar: null, role: 'player' });
    const sit = i < n * seatedShare, s = seats[Math.floor(Math.random() * seats.length)];
    Object.assign(p, sit ? { x: s.x, z: s.z, y: s.gy, sit: 1, fresh: false } : { x: -60 + Math.random() * 160, z: -90 + Math.random() * 100, y: 0, mv: 1, fresh: false });
    bots.push({ p, sit, tx: -60 + Math.random() * 160, tz: -90 + Math.random() * 100 });
  }
  const ticks = 200; bytes.v = 0; const t0 = process.hrtime.bigint();
  for (let k = 0; k < ticks; k++) {
    for (const b of bots) if (!b.sit) { const d = Math.hypot(b.tx - b.p.x, b.tz - b.p.z) || 1; b.p.x += (b.tx - b.p.x) / d * 0.4; b.p.z += (b.tz - b.p.z) / d * 0.4; b.p.yaw = k * 0.01; }
    game.tick();
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / ticks;
  return { players: n, seated: `${Math.round(seatedShare * 100)}%`, 'ms per tick': ms.toFixed(2), 'KB/s per player': (bytes.v / (ticks * L.tickMs / 1000) / n / 1024).toFixed(1), 'Mbit/s total out': (bytes.v * 8 / (ticks * L.tickMs / 1000) / 1e6).toFixed(1) };
}
console.table([scenario(50, 0.6), scenario(100, 0.6), scenario(200, 0.6), scenario(200, 0), scenario(200, 0.95)]);
console.log(`tick budget is ${L.tickMs} ms; these timings are from the machine running this script, not your server.`);
process.exit(0);
