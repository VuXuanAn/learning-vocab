-- Run as postgres after 003. Safe to rerun; preserves all data and grants.
-- Fixes 42501 when the frontend creates a folder and requests the inserted row.
begin;
drop policy if exists folders_read on public.folders;
create policy folders_read on public.folders for select to authenticated
using (
  owner_id = (select auth.uid())
  or vocab_private.folder_access(id)
);
commit;
