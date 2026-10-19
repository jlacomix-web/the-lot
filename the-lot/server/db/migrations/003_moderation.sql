alter table users add column if not exists ban_reason text;
alter table users add column if not exists muted_until timestamptz;

create table if not exists reports (
  id          bigserial primary key,
  reporter_id uuid references users(id) on delete set null,
  reported_id uuid references users(id) on delete set null,
  reason      text not null,
  context     jsonb,                                  -- recent chat lines saved with the report
  handled     boolean not null default false,
  handled_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists reports_open on reports (handled, id desc);

create table if not exists audit_log (
  id         bigserial primary key,
  actor_id   uuid references users(id) on delete set null,
  action     text not null,
  target_id  uuid references users(id) on delete set null,
  detail     text,
  created_at timestamptz not null default now()
);
