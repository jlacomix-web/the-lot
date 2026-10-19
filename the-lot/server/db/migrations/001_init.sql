create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  email          citext unique not null,
  password_hash  text not null,
  display_name   text not null,
  email_verified boolean not null default false,
  role           text not null default 'player' check (role in ('player','moderator','admin')),
  banned_until   timestamptz,
  created_at     timestamptz not null default now()
);
create table if not exists avatars (
  user_id    uuid primary key references users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists mutes (
  muter_id uuid references users(id) on delete cascade,
  muted_id uuid references users(id) on delete cascade,
  primary key (muter_id, muted_id)
);
