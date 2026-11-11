-- Run once in Supabase SQL Editor.
create table if not exists public.speaking_recordings (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (length(title) between 1 and 160),
 reference_text text not null default '' check (length(reference_text) <= 12000),
 drive_file_id text not null check (length(drive_file_id) between 1 and 256),
 mime_type text not null check (mime_type like 'audio/%'),
 byte_size bigint not null check (byte_size between 1 and 20971520),
 duration_seconds double precision not null default 0 check (duration_seconds >= 0 and duration_seconds <= 1800),
 created_at timestamptz not null default now(),
 unique(user_id, drive_file_id)
);
create index if not exists speaking_recordings_user_created on public.speaking_recordings(user_id,created_at desc);
alter table public.speaking_recordings enable row level security;
drop policy if exists "Read own recordings" on public.speaking_recordings;
create policy "Read own recordings" on public.speaking_recordings for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own recordings" on public.speaking_recordings;
create policy "Insert own recordings" on public.speaking_recordings for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own recordings" on public.speaking_recordings;
create policy "Update own recordings" on public.speaking_recordings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.speaking_recordings from anon;
grant select,insert,update on public.speaking_recordings to authenticated;
