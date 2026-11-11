begin;
create table if not exists public.reading_folders (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=16384),
 updated_at timestamptz not null default now(), deleted_at timestamptz, unique(id,owner_id)
);
create table if not exists public.reading_articles (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 folder_id uuid not null, data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=8388608),
 updated_at timestamptz not null default now(),deleted_at timestamptz,
 foreign key(folder_id,owner_id) references public.reading_folders(id,owner_id) on delete restrict
);
create index if not exists reading_articles_folder_idx on public.reading_articles(folder_id);
alter table public.reading_folders enable row level security;
alter table public.reading_articles enable row level security;
drop policy if exists "Own reading folders" on public.reading_folders;
create policy "Own reading folders" on public.reading_folders for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "Own reading articles" on public.reading_articles;
create policy "Own reading articles" on public.reading_articles for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
revoke all on public.reading_folders,public.reading_articles from anon;
grant select,insert,update,delete on public.reading_folders,public.reading_articles to authenticated;
commit;
