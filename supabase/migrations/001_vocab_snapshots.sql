-- Run once in Supabase Dashboard > SQL Editor.
create table if not exists public.vocab_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.vocab_snapshots enable row level security;
drop policy if exists "Read own vocabulary" on public.vocab_snapshots;
create policy "Read own vocabulary" on public.vocab_snapshots for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own vocabulary" on public.vocab_snapshots;
create policy "Insert own vocabulary" on public.vocab_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own vocabulary" on public.vocab_snapshots;
create policy "Update own vocabulary" on public.vocab_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.vocab_snapshots from anon;
grant select, insert, update on public.vocab_snapshots to authenticated;

-- Atomic revision check: a second device cannot silently overwrite newer data.
create or replace function public.save_vocab_snapshot(p_payload jsonb, p_expected_revision bigint, p_user_id uuid)
returns table(revision bigint, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_revision bigint;
begin
  if v_user is null or p_user_id is null or v_user <> p_user_id then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision' using errcode = '22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_payload->>'version' is distinct from '1' or octet_length(p_payload::text) > 20971520 then raise exception 'Invalid or oversized snapshot' using errcode = '22023'; end if;
  if p_expected_revision = 0 then
    insert into public.vocab_snapshots as s(user_id, payload) values(v_user, p_payload) on conflict (user_id) do nothing;
    if not found then raise exception 'Cloud changed; download first' using errcode = '40001'; end if;
  else
    update public.vocab_snapshots as s set payload=p_payload, revision=s.revision+1, updated_at=now() where s.user_id=v_user and s.revision=p_expected_revision;
    if not found then raise exception 'Cloud changed; download first' using errcode = '40001'; end if;
  end if;
  return query select s.revision, s.updated_at from public.vocab_snapshots as s where s.user_id=v_user;
end;
$$;
revoke all on function public.save_vocab_snapshot(jsonb, bigint, uuid) from public, anon;
grant execute on function public.save_vocab_snapshot(jsonb, bigint, uuid) to authenticated;

