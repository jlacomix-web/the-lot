import fs from 'node:fs';
import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
export const q = (text, params) => pool.query(text, params);

// Applies db/migrations/*.sql once each, in name order. Safe to run on every start.
export async function migrate() {
  await q('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const dir = new URL('../db/migrations/', import.meta.url);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const done = new Set((await q('select name from schema_migrations')).rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query(fs.readFileSync(new URL(f, dir), 'utf8'));
      await c.query('insert into schema_migrations (name) values ($1)', [f]);
      await c.query('commit');
      console.log('migrated', f);
    } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
  }
}
