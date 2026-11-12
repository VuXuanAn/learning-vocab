begin;
alter table public.shadowing_lessons add column if not exists detection jsonb;
commit;
