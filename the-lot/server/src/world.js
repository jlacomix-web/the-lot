// Seat positions on the server, from the same layout numbers the client uses (client/assets/world.json).
import fs from 'node:fs';

function load() {
  for (const p of ['../shared/world.json', '../../client/assets/world.json']) {
    try { return JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8')); } catch { /* try next */ }
  }
  throw new Error('world.json not found');
}
export const WORLD = load();
const { HX, HZ, HS } = WORLD.hall;
const yAt = (L, lz) => (L.edge === null ? 0.25 : L.y0 + (lz - L.edge) * WORLD.slope);

// id "level-row-seat" -> world position and floor height
export const SEATS = new Map();
WORLD.levels.forEach((L, li) => {
  for (let i = 0; i < L.rows; i++) {
    const lz = li ? L.edge + 1.2 + i * 1.7 : L.start + i * 1.7, yl = yAt(L, lz);
    let n = 1;
    for (const [a, b] of WORLD.sections) for (let x = a + 0.5; x < b; x += 1) { SEATS.set(`${li}-${i}-${n}`, { x: HX - lz * HS, z: HZ + x * HS, gy: (yl - 0.25) * HS }); n++; }
  }
});
