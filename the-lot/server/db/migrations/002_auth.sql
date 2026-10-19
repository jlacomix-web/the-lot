create unique index if not exists users_display_name_lower on users (lower(display_name));
create table if not exists sessions (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text
);
create index if not exists sessions_user on sessions (user_id);
create table if not exists email_tokens (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null check (kind in ('verify','reset')),
  expires_at timestamptz not null,
  used_at    timestamptz
);
