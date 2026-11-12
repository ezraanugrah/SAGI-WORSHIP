-- SagiWorship: sync Jadwal Ibadah (Week 1-4) between laptops, next to the
-- songs, media and themes (run songs-sync.sql and library-sync.sql first).
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Safe to run again.

-- Shared rule for synced rows (same as library-sync.sql): a new row starts
-- at version 1 and every change raises it by exactly one.
create or replace function public.sagi_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.version <> 1 then
    raise exception 'a new row starts at version 1';
  end if;
  if tg_op = 'UPDATE' and new.version <> old.version + 1 then
    raise exception 'version must go up by one';
  end if;
  new.updated_at := clock_timestamp();
  new.updated_by := auth.jwt() ->> 'email';
  return new;
end $$;

-- One row per Week ("week-1" ... "week-4"): its items in order. Songs are
-- named by id, media by file fingerprint, verses by Bible edition.
create table if not exists public.schedules (
  id text primary key check (id ~ '^week-[1-4]$'),
  data jsonb not null,
  version integer not null check (version > 0),
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by text
);
create index if not exists schedules_updated_at on public.schedules (updated_at);
drop trigger if exists schedules_touch on public.schedules;
create trigger schedules_touch before insert or update on public.schedules
  for each row execute function public.sagi_touch();

-- Only signed-in church accounts can read or change them.
alter table public.schedules enable row level security;
drop policy if exists "schedules: signed-in read" on public.schedules;
create policy "schedules: signed-in read" on public.schedules
  for select to authenticated using (true);
drop policy if exists "schedules: signed-in insert" on public.schedules;
create policy "schedules: signed-in insert" on public.schedules
  for insert to authenticated with check (true);
drop policy if exists "schedules: signed-in update" on public.schedules;
create policy "schedules: signed-in update" on public.schedules
  for update to authenticated using (true) with check (true);
revoke delete on public.schedules from anon, authenticated;
revoke all on public.schedules from anon;
grant select, insert, update on public.schedules to authenticated;

-- Let the API see the new table right away.
notify pgrst, 'reload schema';
