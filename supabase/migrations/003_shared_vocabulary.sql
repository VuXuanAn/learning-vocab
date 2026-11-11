-- Run once as postgres in Supabase SQL Editor. Requires Supabase Auth.
-- Independent of vocab_snapshots. Keep 002_user_preferences.sql for settings.
-- If these tables already exist from an earlier run, do not rerun this file.
begin;
create schema if not exists vocab_private;
revoke all on schema vocab_private from public, anon;
grant usage on schema vocab_private to authenticated;

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  name text not null check (length(btrim(name)) between 1 and 500),
  parent_id uuid references public.folders(id) on delete set null,
  reverse_cards boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_id, legacy_id),
  check (parent_id is distinct from id)
);
create table public.folder_members (
  folder_id uuid not null references public.folders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);
-- Ownership lives only in folders.owner_id; it cannot be granted through members.
create table public.card_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, legacy_id)
);
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  legacy_id text,
  kind text not null check (kind in ('basic', 'reverse', 'cloze', 'custom', 'ai')),
  front text not null default '', back text not null default '',
  extra text not null default '', tags text not null default '',
  field_values jsonb not null default '{}' check (jsonb_typeof(field_values) = 'object'),
  -- Embedded template lets every member render the shared note independently.
  template jsonb check (template is null or jsonb_typeof(template) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (created_by, legacy_id)
);
create table public.user_card_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  card_key text not null,
  due timestamptz not null,
  fsrs jsonb not null check (jsonb_typeof(fsrs) = 'object'),
  last_rating smallint not null check (last_rating between 1 and 4),
  review_revision bigint not null check (review_revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, note_id, card_key)
);
create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  note_id uuid not null references public.notes(id) on delete cascade,
  card_key text not null,
  reviewed_at timestamptz not null,
  log jsonb not null check (jsonb_typeof(log) = 'object'),
  unique (user_id, legacy_id)
);
create index folders_owner_idx on public.folders(owner_id);
create index folders_parent_idx on public.folders(parent_id);
create index folder_members_user_idx on public.folder_members(user_id, folder_id);
create index notes_folder_updated_idx on public.notes(folder_id, updated_at, id);
create index templates_user_idx on public.card_templates(user_id);
create index progress_user_due_idx on public.user_card_progress(user_id, due);
create index progress_note_idx on public.user_card_progress(note_id);
create index logs_user_review_idx on public.review_logs(user_id, reviewed_at);
create index logs_note_idx on public.review_logs(note_id);

-- Helper functions avoid recursive RLS between folders and folder_members.
-- Do not add vocab_private to Supabase API Exposed schemas.
create function vocab_private.folder_access(p_folder uuid, p_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.folders f where f.id = p_folder and (not p_write or f.deleted_at is null) and (
      f.owner_id = (select auth.uid()) or exists (
        select 1 from public.folder_members m
        where m.folder_id = f.id and m.user_id = (select auth.uid())
          and (not p_write or m.role = 'editor')
      )
    )
  );
$$;
create function vocab_private.owns_folder(p_folder uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.folders f where f.id = p_folder and f.owner_id = (select auth.uid()));
$$;
create function vocab_private.note_access(p_note uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.notes n where n.id = p_note and vocab_private.folder_access(n.folder_id));
$$;
create function vocab_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end;
$$;
create function vocab_private.check_folder_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null then
    if not exists(select 1 from public.folders p where p.id = new.parent_id and p.owner_id = new.owner_id) then
      raise exception 'Parent folder must have the same owner' using errcode = '23514';
    end if;
    if exists (
      with recursive ancestors as (
        select f.id, f.parent_id from public.folders f where f.id = new.parent_id
        union
        select f.id, f.parent_id from public.folders f join ancestors a on f.id = a.parent_id
      ) select 1 from ancestors where id = new.id
    ) then raise exception 'Folder hierarchy cannot contain cycles' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;
create trigger folders_parent_check before insert or update of parent_id, owner_id on public.folders
for each row execute function vocab_private.check_folder_parent();
create trigger folders_updated before update on public.folders for each row execute function vocab_private.touch_updated_at();
create trigger notes_updated before update on public.notes for each row execute function vocab_private.touch_updated_at();
create trigger templates_updated before update on public.card_templates for each row execute function vocab_private.touch_updated_at();
create trigger progress_updated before update on public.user_card_progress for each row execute function vocab_private.touch_updated_at();

alter table public.folders enable row level security;
alter table public.folder_members enable row level security;
alter table public.card_templates enable row level security;
alter table public.notes enable row level security;
alter table public.user_card_progress enable row level security;
alter table public.review_logs enable row level security;

-- Check the new row's owner directly so INSERT ... RETURNING works.
-- A STABLE helper querying folders cannot see a row inserted by this statement.
create policy folders_read on public.folders for select to authenticated
using (owner_id = (select auth.uid()) or vocab_private.folder_access(id));
create policy folders_insert on public.folders for insert to authenticated with check (owner_id = (select auth.uid()));
create policy folders_update on public.folders for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- Only the owner manages sharing; other members can see only their own membership.
create policy members_read on public.folder_members for select to authenticated
using (user_id = (select auth.uid()) or vocab_private.owns_folder(folder_id));
create policy members_insert on public.folder_members for insert to authenticated with check (vocab_private.owns_folder(folder_id));
create policy members_update on public.folder_members for update to authenticated
using (vocab_private.owns_folder(folder_id)) with check (vocab_private.owns_folder(folder_id));
create policy members_delete on public.folder_members for delete to authenticated using (vocab_private.owns_folder(folder_id));
create policy templates_read on public.card_templates for select to authenticated using (user_id = (select auth.uid()));
create policy templates_insert on public.card_templates for insert to authenticated with check (user_id = (select auth.uid()));
create policy templates_update on public.card_templates for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notes_read on public.notes for select to authenticated using (vocab_private.folder_access(folder_id));
create policy notes_insert on public.notes for insert to authenticated
with check (created_by = (select auth.uid()) and vocab_private.folder_access(folder_id, true));
create policy notes_update on public.notes for update to authenticated
using (vocab_private.folder_access(folder_id, true)) with check (vocab_private.folder_access(folder_id, true));
create policy progress_read on public.user_card_progress for select to authenticated
using (user_id = (select auth.uid()) and vocab_private.note_access(note_id));
create policy progress_insert on public.user_card_progress for insert to authenticated
with check (user_id = (select auth.uid()) and vocab_private.note_access(note_id));
create policy progress_update on public.user_card_progress for update to authenticated
using (user_id = (select auth.uid()) and vocab_private.note_access(note_id))
with check (user_id = (select auth.uid()) and vocab_private.note_access(note_id));
create policy logs_read on public.review_logs for select to authenticated
using (user_id = (select auth.uid()) and vocab_private.note_access(note_id));
create policy logs_insert on public.review_logs for insert to authenticated
with check (user_id = (select auth.uid()) and vocab_private.note_access(note_id));

-- Reset defaults explicitly: no anonymous access or authenticated hard deletes.
revoke all on public.folders, public.folder_members, public.card_templates, public.notes,
public.user_card_progress, public.review_logs from public, anon, authenticated;
grant select on public.folders, public.folder_members, public.card_templates, public.notes,
public.user_card_progress, public.review_logs to authenticated;
grant insert (id, owner_id, name, parent_id, reverse_cards) on public.folders to authenticated;
grant update (name, parent_id, reverse_cards, deleted_at) on public.folders to authenticated;
grant insert, delete on public.folder_members to authenticated;
grant update (role) on public.folder_members to authenticated;
grant insert (id, user_id, definition) on public.card_templates to authenticated;
grant update (definition, deleted_at) on public.card_templates to authenticated;
grant insert (id, folder_id, created_by, kind, front, back, extra, tags, field_values, template) on public.notes to authenticated;
grant update (folder_id, kind, front, back, extra, tags, field_values, template, deleted_at) on public.notes to authenticated;
grant insert (user_id, note_id, card_key, due, fsrs, last_rating, review_revision) on public.user_card_progress to authenticated;
grant update (due, fsrs, last_rating, review_revision) on public.user_card_progress to authenticated;
grant insert (id, user_id, note_id, card_key, reviewed_at, log) on public.review_logs to authenticated;
revoke all on function vocab_private.folder_access(uuid, boolean), vocab_private.owns_folder(uuid),
vocab_private.note_access(uuid), vocab_private.touch_updated_at(), vocab_private.check_folder_parent() from public, anon, authenticated;
grant execute on function vocab_private.folder_access(uuid, boolean), vocab_private.owns_folder(uuid),
vocab_private.note_access(uuid) to authenticated;
commit;
