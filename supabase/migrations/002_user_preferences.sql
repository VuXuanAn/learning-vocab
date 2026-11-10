-- Run once in Supabase Dashboard > SQL Editor, after 001_vocab_snapshots.sql.
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{"reminderEnabled":true,"reminderMinutes":5,"autoVoice":false}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint valid_user_preferences check (
    jsonb_typeof(preferences) = 'object'
    and preferences ?& array['reminderEnabled','reminderMinutes','autoVoice']
    and preferences - array['reminderEnabled','reminderMinutes','autoVoice'] = '{}'::jsonb
    and jsonb_typeof(preferences->'reminderEnabled') = 'boolean'
    and jsonb_typeof(preferences->'autoVoice') = 'boolean'
    and jsonb_typeof(preferences->'reminderMinutes') = 'number'
    and (preferences->>'reminderMinutes')::numeric between 1 and 120
    and mod((preferences->>'reminderMinutes')::numeric, 1) = 0
  )
);
alter table public.user_preferences enable row level security;
drop policy if exists "Read own preferences" on public.user_preferences;
create policy "Read own preferences" on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own preferences" on public.user_preferences;
create policy "Insert own preferences" on public.user_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own preferences" on public.user_preferences;
create policy "Update own preferences" on public.user_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.user_preferences from anon;
grant select, insert, update on public.user_preferences to authenticated;

-- Merge only changed fields so separate devices don't overwrite unrelated settings.
create or replace function public.save_user_preferences(p_user_id uuid, p_patch jsonb)
returns table(preferences jsonb, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or p_user_id is null or auth.uid() <> p_user_id then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or
     p_patch - array['reminderEnabled','reminderMinutes','autoVoice'] <> '{}'::jsonb then
    raise exception 'Invalid preferences patch' using errcode = '22023';
  end if;
  return query
    insert into public.user_preferences as s(user_id, preferences)
    values(p_user_id, '{"reminderEnabled":true,"reminderMinutes":5,"autoVoice":false}'::jsonb || p_patch)
    on conflict (user_id) do update
      set preferences = s.preferences || p_patch, updated_at = now()
    returning s.preferences, s.updated_at;
end;
$$;
revoke all on function public.save_user_preferences(uuid, jsonb) from public, anon;
grant execute on function public.save_user_preferences(uuid, jsonb) to authenticated;
