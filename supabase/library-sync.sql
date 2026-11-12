-- SagiWorship: sync Media (pictures, videos, PDFs) and Themes between
-- laptops, next to the Musik songs (songs-sync.sql must have run first).
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Safe to run again.

-- Shared rule for synced rows: a new row starts at version 1 and every
-- change raises it by exactly one (no silent overwrites).
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

-- Media library: the asset description (title, kind, size, digests) and the
-- list of 4 MiB chunks of its files. The bytes live in Storage (below).
create table if not exists public.media (
  id text primary key check (char_length(id) between 1 and 160),
  data jsonb not null,
  version integer not null check (version > 0),
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by text
);
create index if not exists media_updated_at on public.media (updated_at);
drop trigger if exists media_touch on public.media;
create trigger media_touch before insert or update on public.media
  for each row execute function public.sagi_touch();

-- Themes: name and background/text look (built-in themes are not stored).
create table if not exists public.themes (
  id text primary key check (char_length(id) between 1 and 160),
  data jsonb not null,
  version integer not null check (version > 0),
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by text
);
create index if not exists themes_updated_at on public.themes (updated_at);
drop trigger if exists themes_touch on public.themes;
create trigger themes_touch before insert or update on public.themes
  for each row execute function public.sagi_touch();

-- Only signed-in church accounts can read or change them.
alter table public.media enable row level security;
alter table public.themes enable row level security;
drop policy if exists "media: signed-in read" on public.media;
create policy "media: signed-in read" on public.media
  for select to authenticated using (true);
drop policy if exists "media: signed-in insert" on public.media;
create policy "media: signed-in insert" on public.media
  for insert to authenticated with check (true);
drop policy if exists "media: signed-in update" on public.media;
create policy "media: signed-in update" on public.media
  for update to authenticated using (true) with check (true);
drop policy if exists "themes: signed-in read" on public.themes;
create policy "themes: signed-in read" on public.themes
  for select to authenticated using (true);
drop policy if exists "themes: signed-in insert" on public.themes;
create policy "themes: signed-in insert" on public.themes
  for insert to authenticated with check (true);
drop policy if exists "themes: signed-in update" on public.themes;
create policy "themes: signed-in update" on public.themes
  for update to authenticated using (true) with check (true);
-- No delete policy on purpose: rows are only marked deleted.
revoke delete on public.media, public.themes from anon, authenticated;
revoke all on public.media, public.themes from anon;
grant select, insert, update on public.media, public.themes to authenticated;

-- File bytes: a private bucket of 4 MiB chunks named after their SHA-256,
-- so a big video is many small uploads and the same file is never stored
-- twice. Chunks are never overwritten or deleted by the app.
insert into storage.buckets (id, name, public, file_size_limit)
values ('sagi-media', 'sagi-media', false, 5242880)
on conflict (id) do nothing;
drop policy if exists "sagi-media: signed-in read" on storage.objects;
create policy "sagi-media: signed-in read" on storage.objects
  for select to authenticated using (bucket_id = 'sagi-media');
drop policy if exists "sagi-media: signed-in upload" on storage.objects;
create policy "sagi-media: signed-in upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'sagi-media');

-- Let the API see the new tables right away.
notify pgrst, 'reload schema';
