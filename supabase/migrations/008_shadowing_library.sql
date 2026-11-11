begin;
create table if not exists public.shadowing_folders (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 drive_folder_id text, created_at timestamptz not null default now(),
 unique(id,owner_id)
);
create unique index if not exists shadowing_folder_names on public.shadowing_folders(owner_id,lower(name));
create table if not exists public.shadowing_lessons (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 folder_id uuid not null, title text not null check(length(trim(title)) between 1 and 160),
 reference_text text not null default '' check(length(reference_text)<=12000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(folder_id,owner_id) references public.shadowing_folders(id,owner_id) on delete restrict
);
alter table public.speaking_recordings add column if not exists lesson_id uuid references public.shadowing_lessons(id) on delete restrict;
create index if not exists shadowing_lessons_folder_idx on public.shadowing_lessons(folder_id);
create index if not exists speaking_recordings_lesson_idx on public.speaking_recordings(lesson_id,created_at desc);

-- Keep all older uploaded recordings; each becomes an initial lesson.
insert into public.shadowing_folders(id,owner_id,name)
 select md5(user_id::text||':shadowing-default')::uuid,user_id,'Bài shadowing đã lưu'
 from public.speaking_recordings where lesson_id is null group by user_id
 on conflict do nothing;
insert into public.shadowing_lessons(id,owner_id,folder_id,title,reference_text,created_at,updated_at)
 select r.id,r.user_id,md5(r.user_id::text||':shadowing-default')::uuid,r.title,r.reference_text,r.created_at,r.created_at
 from public.speaking_recordings r where r.lesson_id is null
 on conflict(id) do nothing;
update public.speaking_recordings set lesson_id=id where lesson_id is null;

-- Collaboration schema; invitation/review/comment UI is intentionally deferred.
create table if not exists public.shadowing_folder_members (
 folder_id uuid not null references public.shadowing_folders(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('viewer','reviewer')),
 added_by uuid not null references auth.users(id), drive_permission_id text,
 created_at timestamptz not null default now(), primary key(folder_id,user_id)
);
create table if not exists public.shadowing_invitations (
 id uuid primary key default gen_random_uuid(), folder_id uuid not null references public.shadowing_folders(id) on delete cascade,
 invited_by uuid not null references auth.users(id), invited_email text not null check(length(invited_email)<=320 and position('@' in invited_email)>1),
 role text not null check(role in ('viewer','reviewer')), token_hash text unique,
 status text not null default 'pending' check(status in ('pending','accepted','revoked','expired')),
 accepted_by uuid references auth.users(id),expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now()
);
create table if not exists public.shadowing_reviews (
 id uuid primary key default gen_random_uuid(),recording_id uuid not null references public.speaking_recordings(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id),score numeric check(score between 0 and 100),feedback text not null default '' check(length(feedback)<=20000),
 status text not null default 'draft' check(status in ('draft','submitted')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(recording_id,reviewer_id)
);
create table if not exists public.shadowing_comments (
 id uuid primary key default gen_random_uuid(),lesson_id uuid not null references public.shadowing_lessons(id) on delete cascade,
 recording_id uuid,author_id uuid not null references auth.users(id),parent_id uuid,
 body text not null check(length(trim(body)) between 1 and 10000),audio_second numeric check(audio_second>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,lesson_id),
 foreign key(parent_id,lesson_id) references public.shadowing_comments(id,lesson_id) on delete cascade,
 check(recording_id is not null or audio_second is null)
);
-- Keep comments attached to the correct lesson's recording.
create unique index if not exists speaking_recording_lesson_unique on public.speaking_recordings(id,lesson_id);
alter table public.shadowing_comments drop constraint if exists shadowing_comment_recording_lesson_fk;
alter table public.shadowing_comments add constraint shadowing_comment_recording_lesson_fk foreign key(recording_id,lesson_id) references public.speaking_recordings(id,lesson_id) on delete cascade;
create index if not exists shadowing_members_user_idx on public.shadowing_folder_members(user_id,folder_id);
create index if not exists shadowing_comments_lesson_idx on public.shadowing_comments(lesson_id,created_at);
create index if not exists shadowing_reviews_recording_idx on public.shadowing_reviews(recording_id);

create or replace function public.owns_shadowing_folder(p_folder uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shadowing_folders where id=p_folder and owner_id=auth.uid());
$$;
create or replace function public.can_view_shadowing_folder(p_folder uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.owns_shadowing_folder(p_folder) or exists(select 1 from public.shadowing_folder_members where folder_id=p_folder and user_id=auth.uid());
$$;
create or replace function public.can_review_shadowing_folder(p_folder uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.owns_shadowing_folder(p_folder) or exists(select 1 from public.shadowing_folder_members where folder_id=p_folder and user_id=auth.uid() and role='reviewer');
$$;
revoke all on function public.owns_shadowing_folder(uuid),public.can_view_shadowing_folder(uuid),public.can_review_shadowing_folder(uuid) from public,anon;
grant execute on function public.owns_shadowing_folder(uuid),public.can_view_shadowing_folder(uuid),public.can_review_shadowing_folder(uuid) to authenticated;

alter table public.shadowing_folders enable row level security;
alter table public.shadowing_lessons enable row level security;
alter table public.shadowing_folder_members enable row level security;
alter table public.shadowing_invitations enable row level security;
alter table public.shadowing_reviews enable row level security;
alter table public.shadowing_comments enable row level security;

drop policy if exists "View shadowing folders" on public.shadowing_folders;
create policy "View shadowing folders" on public.shadowing_folders for select to authenticated using(public.can_view_shadowing_folder(id));
drop policy if exists "Own shadowing folders" on public.shadowing_folders;
create policy "Own shadowing folders" on public.shadowing_folders for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "View shadowing lessons" on public.shadowing_lessons;
create policy "View shadowing lessons" on public.shadowing_lessons for select to authenticated using(public.can_view_shadowing_folder(folder_id));
drop policy if exists "Own shadowing lessons" on public.shadowing_lessons;
create policy "Own shadowing lessons" on public.shadowing_lessons for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid() and public.owns_shadowing_folder(folder_id));
drop policy if exists "View shadowing members" on public.shadowing_folder_members;
create policy "View shadowing members" on public.shadowing_folder_members for select to authenticated using(user_id=auth.uid() or public.owns_shadowing_folder(folder_id));
drop policy if exists "Manage shadowing members" on public.shadowing_folder_members;
create policy "Manage shadowing members" on public.shadowing_folder_members for all to authenticated using(public.owns_shadowing_folder(folder_id)) with check(public.owns_shadowing_folder(folder_id));
drop policy if exists "Manage shadowing invitations" on public.shadowing_invitations;
create policy "Manage shadowing invitations" on public.shadowing_invitations for all to authenticated using(public.owns_shadowing_folder(folder_id)) with check(public.owns_shadowing_folder(folder_id) and invited_by=auth.uid());
drop policy if exists "Read own recordings" on public.speaking_recordings;
drop policy if exists "Read accessible recordings" on public.speaking_recordings;
create policy "Read accessible recordings" on public.speaking_recordings for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.shadowing_lessons l where l.id=lesson_id and public.can_view_shadowing_folder(l.folder_id)));
drop policy if exists "Insert own recordings" on public.speaking_recordings;
create policy "Insert own recordings" on public.speaking_recordings for insert to authenticated with check(user_id=auth.uid() and (lesson_id is null or exists(select 1 from public.shadowing_lessons l where l.id=lesson_id and l.owner_id=auth.uid())));
drop policy if exists "Update own recordings" on public.speaking_recordings;
create policy "Update own recordings" on public.speaking_recordings for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and (lesson_id is null or exists(select 1 from public.shadowing_lessons l where l.id=lesson_id and l.owner_id=auth.uid())));
drop policy if exists "View shadowing reviews" on public.shadowing_reviews;
create policy "View shadowing reviews" on public.shadowing_reviews for select to authenticated using(exists(select 1 from public.speaking_recordings r join public.shadowing_lessons l on l.id=r.lesson_id where r.id=recording_id and public.can_view_shadowing_folder(l.folder_id)));
drop policy if exists "Write shadowing reviews" on public.shadowing_reviews;
create policy "Write shadowing reviews" on public.shadowing_reviews for all to authenticated using(reviewer_id=auth.uid() and exists(select 1 from public.speaking_recordings r join public.shadowing_lessons l on l.id=r.lesson_id where r.id=recording_id and public.can_review_shadowing_folder(l.folder_id))) with check(reviewer_id=auth.uid() and exists(select 1 from public.speaking_recordings r join public.shadowing_lessons l on l.id=r.lesson_id where r.id=recording_id and public.can_review_shadowing_folder(l.folder_id)));
drop policy if exists "View shadowing comments" on public.shadowing_comments;
create policy "View shadowing comments" on public.shadowing_comments for select to authenticated using(exists(select 1 from public.shadowing_lessons l where l.id=lesson_id and public.can_view_shadowing_folder(l.folder_id)));
drop policy if exists "Write shadowing comments" on public.shadowing_comments;
create policy "Write shadowing comments" on public.shadowing_comments for all to authenticated using(author_id=auth.uid() and exists(select 1 from public.shadowing_lessons l where l.id=lesson_id and public.can_review_shadowing_folder(l.folder_id))) with check(author_id=auth.uid() and exists(select 1 from public.shadowing_lessons l where l.id=lesson_id and public.can_review_shadowing_folder(l.folder_id)));
revoke all on public.shadowing_folders,public.shadowing_lessons,public.shadowing_folder_members,public.shadowing_invitations,public.shadowing_reviews,public.shadowing_comments from anon;
grant select,insert,update,delete on public.shadowing_folders,public.shadowing_lessons,public.shadowing_folder_members,public.shadowing_invitations,public.shadowing_reviews,public.shadowing_comments to authenticated;
commit;
