begin;
create table if not exists public.grammar_folders (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=16384),
 updated_at timestamptz not null default clock_timestamp(), deleted_at timestamptz,
 unique(id,owner_id)
);
create table if not exists public.grammar_entries (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 folder_id uuid not null,
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=16777216),
 updated_at timestamptz not null default clock_timestamp(), deleted_at timestamptz,
 foreign key(folder_id,owner_id) references public.grammar_folders(id,owner_id) on delete restrict
);
create index if not exists grammar_folders_owner_idx on public.grammar_folders(owner_id);
create index if not exists grammar_entries_owner_folder_idx on public.grammar_entries(owner_id,folder_id);
create or replace function public.touch_grammar_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end;
$$;
drop trigger if exists grammar_folders_updated on public.grammar_folders;
create trigger grammar_folders_updated before update on public.grammar_folders for each row execute function public.touch_grammar_updated_at();
drop trigger if exists grammar_entries_updated on public.grammar_entries;
create trigger grammar_entries_updated before update on public.grammar_entries for each row execute function public.touch_grammar_updated_at();
alter table public.grammar_folders enable row level security;
alter table public.grammar_entries enable row level security;
drop policy if exists "Own grammar folders" on public.grammar_folders;
create policy "Own grammar folders" on public.grammar_folders for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "Own grammar entries" on public.grammar_entries;
create policy "Own grammar entries" on public.grammar_entries for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
revoke all on public.grammar_folders,public.grammar_entries from anon;
grant select,insert,update on public.grammar_folders,public.grammar_entries to authenticated;
commit;
