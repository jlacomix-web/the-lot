// Admin tool. Run inside the game container:
//   docker compose exec game node scripts/admin.mjs <command> ...
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (s, p) => pool.query(s, p);
const [, , cmd, ...a] = process.argv;
const find = async (who) => (await q('select id, email, display_name, role from users where lower(email) = lower($1) or lower(display_name) = lower($1)', [who])).rows[0];
const need = async (who) => { const u = await find(who || ''); if (!u) { console.error('No such user:', who); process.exit(1); } return u; };

const help = `Commands:
  users [count]                       list the newest accounts
  promote <email|name> <role>         role = player | moderator | admin   (use this to create your first admin)
  ban <email|name> <hours|perm> [why] suspend an account and sign it out
  unban <email|name>
  reports [count]                     open reports with the chat lines saved at the time
  resolve <id>                        mark a report handled
  audit [count]                       recent moderator actions
  signout <email|name>                end all sessions for an account
  delete-user <email|name> --yes      permanently delete an account and its data`;

try {
  switch (cmd) {
    case 'users': console.table((await q('select display_name, email, role, email_verified, banned_until, created_at from users order by created_at desc limit $1', [Number(a[0]) || 25])).rows); break;
    case 'promote': {
      if (!['player', 'moderator', 'admin'].includes(a[1])) { console.error('Role must be player, moderator or admin.'); process.exit(1); }
      const u = await need(a[0]); await q('update users set role = $2 where id = $1', [u.id, a[1]]); console.log(`${u.display_name} is now ${a[1]}. They need to reconnect for it to apply.`); break;
    }
    case 'ban': {
      const u = await need(a[0]), dur = a[1], why = a.slice(2).join(' ') || null;
      if (dur === 'perm') await q(`update users set banned_until = '9999-12-31', ban_reason = $2 where id = $1`, [u.id, why]);
      else if (Number(dur) >= 1) await q(`update users set banned_until = now() + ($3 || ' hours')::interval, ban_reason = $2 where id = $1`, [u.id, why, String(Number(dur))]);
      else { console.error('Give hours or "perm".'); process.exit(1); }
      await q('delete from sessions where user_id = $1', [u.id]); console.log(`Banned ${u.display_name}.`); break;
    }
    case 'unban': { const u = await need(a[0]); await q('update users set banned_until = null, ban_reason = null where id = $1', [u.id]); console.log(`Unbanned ${u.display_name}.`); break; }
    case 'reports': {
      const r = await q(`select r.id, a.display_name as reporter, b.display_name as reported, r.reason, r.created_at, r.context from reports r
                         left join users a on a.id = r.reporter_id left join users b on b.id = r.reported_id where not r.handled order by r.id desc limit $1`, [Number(a[0]) || 20]);
      for (const x of r.rows) { console.log(`\n#${x.id}  ${x.reporter} reported ${x.reported}  (${x.created_at.toISOString()})\n  Reason: ${x.reason}`); for (const c of x.context || []) console.log(`    ${c.name}: ${c.text}`); }
      if (!r.rows.length) console.log('No open reports.'); break;
    }
    case 'resolve': await q('update reports set handled = true where id = $1', [Number(a[0])]); console.log('Done.'); break;
    case 'audit': console.table((await q(`select l.created_at, x.display_name as actor, l.action, t.display_name as target, l.detail from audit_log l left join users x on x.id = l.actor_id left join users t on t.id = l.target_id order by l.id desc limit $1`, [Number(a[0]) || 25])).rows); break;
    case 'signout': { const u = await need(a[0]); await q('delete from sessions where user_id = $1', [u.id]); console.log(`Signed out ${u.display_name} everywhere.`); break; }
    case 'delete-user': {
      const u = await need(a[0]); if (a[1] !== '--yes') { console.error(`Add --yes to permanently delete ${u.display_name} (${u.email}).`); process.exit(1); }
      await q('delete from users where id = $1', [u.id]); console.log('Deleted.'); break;
    }
    default: console.log(help);
  }
} finally { await pool.end(); }
