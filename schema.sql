-- Run this in Supabase SQL Editor (fresh setup)
-- If you already ran the old schema, use the migration block at the bottom instead

create table if not exists game_saves (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'New Run',
  state      jsonb not null,
  saved_at   timestamptz not null default now()
);

alter table game_saves enable row level security;

create policy "owner_all" on game_saves
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Migration (only if you already ran the old schema) ─────────────────────
-- alter table game_saves drop constraint if exists game_saves_user_id_unique;
-- alter table game_saves add column if not exists name text not null default 'New Run';
