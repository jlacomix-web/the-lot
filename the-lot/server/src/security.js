import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const N = 32768, R = 8, P = 1, KEYLEN = 64, MAXMEM = 128 * 1024 * 1024;

// Passwords are stored only as salted scrypt hashes (built into Node, no native add-ons).
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}
export async function verifyPassword(pw, stored) {
  try {
    const [alg, n, r, p, s, k] = stored.split('$');
    if (alg !== 'scrypt') return false;
    const want = Buffer.from(k, 'base64');
    const key = await scrypt(pw.normalize('NFKC'), Buffer.from(s, 'base64'), want.length, { N: +n, r: +r, p: +p, maxmem: MAXMEM });
    return crypto.timingSafeEqual(want, key);
  } catch { return false; }
}
let dummy;
export async function dummyVerify(pw) { dummy ??= await hashPassword('not-a-real-password'); return verifyPassword(pw, dummy); } // keeps timing similar for unknown emails

export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

// In-memory sliding-window limiter (resets when the server restarts).
const buckets = new Map();
export function allow(key, max, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { buckets.set(key, arr); return false; }
  arr.push(now); buckets.set(key, arr); return true;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > 3600e3) buckets.delete(k); }, 600e3).unref();

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore */ } }
  }
  return out;
}
