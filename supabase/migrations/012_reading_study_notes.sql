begin;
create unique index if not exists reading_articles_id_owner_unique on public.reading_articles(id,owner_id);
create table if not exists public.reading_study_notes (
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 article_id uuid not null,note_type text not null check(note_type in ('grammar','sentence_structure','expression','other')),
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=262144),
 updated_at timestamptz not null default now(),deleted_at timestamptz,
 foreign key(article_id,owner_id) references public.reading_articles(id,owner_id) on delete cascade
);
create index if not exists reading_study_notes_article_idx on public.reading_study_notes(article_id);
create index if not exists reading_study_notes_type_idx on public.reading_study_notes(owner_id,note_type);
alter table public.reading_study_notes enable row level security;
drop policy if exists "Own reading study notes" on public.reading_study_notes;
create policy "Own reading study notes" on public.reading_study_notes for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
revoke all on public.reading_study_notes from anon;
grant select,insert,update,delete on public.reading_study_notes to authenticated;
-- Keep old notes. Use the article ID in the separate notes table for idempotent migration.
insert into public.reading_study_notes(id,owner_id,article_id,note_type,data,updated_at,deleted_at)
 select id,owner_id,id,'other',jsonb_build_object('id',id,'ownerId',owner_id,'articleId',id,'type','other','title','Ghi chú cũ','content',data->>'note','sourceQuote','','createdAt',coalesce(data->>'createdAt',updated_at::text),'updatedAt',updated_at::text),updated_at,deleted_at
 from public.reading_articles where length(trim(coalesce(data->>'note','')))>0
 on conflict(id) do nothing;
commit;
