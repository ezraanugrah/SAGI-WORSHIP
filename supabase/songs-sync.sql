-- SagiWorship: sync the Musik song library between laptops.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Safe to run again.

create table if not exists public.songs (
  id text primary key check (char_length(id) between 1 and 160),
  -- The song as the app stores it: title, author, category, language,
  -- sections (id, songId, type, label, text) and order.
  data jsonb not null,
  -- Starts at 1 and goes up by exactly one per change; the app only updates
  -- a row when it still has the version it last saw (no silent overwrites).
  version integer not null check (version > 0),
  -- Deleting a song marks it, so the other laptops learn about it too.
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by text
);
create index if not exists songs_updated_at on public.songs (updated_at);

create or replace function public.songs_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.version <> 1 then
    raise exception 'a new song starts at version 1';
  end if;
  if tg_op = 'UPDATE' and new.version <> old.version + 1 then
    raise exception 'version must go up by one';
  end if;
  new.updated_at := clock_timestamp();
  new.updated_by := auth.jwt() ->> 'email';
  return new;
end $$;

drop trigger if exists songs_touch on public.songs;
create trigger songs_touch before insert or update on public.songs
  for each row execute function public.songs_touch();

-- Only signed-in church accounts can read or change songs. Accounts are
-- created by the admin (Authentication > Users); turn OFF public sign-ups
-- (Authentication > Sign In / Providers > "Allow new users to sign up").
alter table public.songs enable row level security;

drop policy if exists "songs: signed-in read" on public.songs;
create policy "songs: signed-in read" on public.songs
  for select to authenticated using (true);

drop policy if exists "songs: signed-in insert" on public.songs;
create policy "songs: signed-in insert" on public.songs
  for insert to authenticated with check (true);

drop policy if exists "songs: signed-in update" on public.songs;
create policy "songs: signed-in update" on public.songs
  for update to authenticated using (true) with check (true);

-- No delete policy on purpose: rows are only marked deleted.
revoke delete on public.songs from anon, authenticated;
revoke all on public.songs from anon;
