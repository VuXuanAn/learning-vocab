begin;
drop policy if exists "Delete own recordings" on public.speaking_recordings;
create policy "Delete own recordings" on public.speaking_recordings for delete to authenticated using(user_id=auth.uid());
grant delete on public.speaking_recordings to authenticated;
create or replace function public.delete_shadowing_recording(p_recording_id uuid,p_check_only boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare owner_uuid uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select user_id into owner_uuid from public.speaking_recordings where id=p_recording_id;
 if found and owner_uuid<>auth.uid() then raise exception 'Only the recording owner can delete' using errcode='42501';end if;
 if not p_check_only then delete from public.speaking_recordings where id=p_recording_id and user_id=auth.uid();end if;
 return true;
end;
$$;
revoke all on function public.delete_shadowing_recording(uuid,boolean) from public,anon;
grant execute on function public.delete_shadowing_recording(uuid,boolean) to authenticated;
commit;
