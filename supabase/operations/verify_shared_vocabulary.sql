-- Run as postgres after 004_remove_vocab_snapshots.sql.
-- Both old object columns must be NULL.
select to_regclass('public.vocab_snapshots') as old_snapshot_table,
  to_regprocedure('public.save_vocab_snapshot(jsonb,bigint,uuid)') as old_snapshot_function;

-- All 7 required tables must have exists=true and rls_enabled=true.
select expected.name,
  c.oid is not null as exists,
  coalesce(c.relrowsecurity, false) as rls_enabled
from (values ('folders'), ('folder_members'), ('card_templates'), ('notes'),
  ('user_card_progress'), ('review_logs'), ('user_preferences')) expected(name)
left join pg_namespace n on n.nspname = 'public'
left join pg_class c on c.relnamespace = n.oid and c.relname = expected.name and c.relkind = 'r'
order by expected.name;

-- Both must be true after migration 005.
select to_regprocedure('public.save_card_review(uuid,text,bigint,jsonb,jsonb)') is not null as review_rpc_exists,
  exists(select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'review_logs' and column_name = 'updated_at') as log_timestamp_exists;

-- Must be true: the owner check must use the row directly for INSERT RETURNING.
select exists (
  select 1 from pg_policies where schemaname = 'public'
    and tablename = 'folders' and policyname = 'folders_read'
    and qual like '%owner_id%'
) as folder_insert_returning_policy_fixed;
