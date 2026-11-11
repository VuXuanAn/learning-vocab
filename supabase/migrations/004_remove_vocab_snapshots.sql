-- Run as postgres AFTER 002 and 003, and ONLY when the new app is ready.
-- Permanently discards old snapshots. No import and no deletion of new tables.
-- Close old clients and reset their old IndexedDB/cache before using the new app.
-- Use the row-sync frontend and migration 005 before opening the app again.
begin;
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'folders', 'folder_members', 'card_templates', 'notes',
    'user_card_progress', 'review_logs', 'user_preferences'
  ] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Missing public.%. Run migrations 002 and 003 first.', table_name;
    end if;
  end loop;
end;
$$;
-- No CASCADE: unexpected dependencies abort the transaction for inspection.
drop function if exists public.save_vocab_snapshot(jsonb, bigint, uuid);
drop table if exists public.vocab_snapshots;
drop table if exists vocab_private.snapshot_imports;
commit;
