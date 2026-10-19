import fs from 'node:fs';

function load() {
  for (const p of ['../shared/avatar-options.json', '../../client/assets/avatar-options.json']) {
    try { return JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8')); } catch { /* try next */ }
  }
  throw new Error('avatar-options.json not found');
}
export const OPTIONS = load();
const KEYS = ['body', 'skin', 'hairStyle', 'hairColor', 'pattern', 'shirt', 'shirt2', 'pants', 'shoes', 'hat', 'glasses'];
const LIST = { shirt2: 'shirt' }; // second pattern color comes from the shirt palette

// An avatar is only a small set of choices. Anything outside the allowed lists is rejected.
export function validateAvatar(a) {
  if (!a || typeof a !== 'object') return null;
  const out = { v: 1 };
  for (const k of KEYS) {
    const n = a[k];
    if (!Number.isInteger(n) || n < 0 || n >= OPTIONS[LIST[k] || k].length) return null;
    out[k] = n;
  }
  return out;
}
