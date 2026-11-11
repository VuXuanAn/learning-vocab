-- Run after 002 and 003. Safe to rerun. Required by the row-sync frontend.
begin;
alter table public.review_logs add column if not exists updated_at timestamptz not null default clock_timestamp();
create index if not exists logs_user_updated_idx on public.review_logs(user_id, updated_at, id);
create or replace function public.save_card_review(
  p_note_id uuid, p_card_key text, p_expected_revision bigint,
  p_progress jsonb, p_logs jsonb
) returns setof public.user_card_progress
language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); current_revision bigint; item jsonb;
begin
  if v_user is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_expected_revision < 0 or p_expected_revision is null or nullif(p_card_key, '') is null
    or jsonb_typeof(p_progress) is distinct from 'object'
    or jsonb_typeof(p_logs) is distinct from 'array' or jsonb_array_length(p_logs) = 0 then
    raise exception 'Invalid review request' using errcode = '22023';
  end if;
  -- Serialize each person's progress on this card, including the first review.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_note_id::text || ':' || p_card_key, 0));
  if not exists (
    select 1 from public.notes n join public.folders f on f.id = n.folder_id
    where n.id = p_note_id and n.deleted_at is null and f.deleted_at is null
  ) then raise exception 'Note unavailable' using errcode = '42501'; end if;
  select review_revision into current_revision from public.user_card_progress
    where user_id = v_user and note_id = p_note_id and card_key = p_card_key;
  -- An acknowledged request may have lost its response. Repeating the same logs
  -- must not apply the review twice or overwrite a newer schedule.
  if not exists (
    select 1 from jsonb_array_elements(p_logs) e
    where not exists(select 1 from public.review_logs l where l.id = (e->>'id')::uuid
      and l.user_id = v_user and l.note_id = p_note_id and l.card_key = p_card_key)
  ) then
    return query select * from public.user_card_progress
      where user_id = v_user and note_id = p_note_id and card_key = p_card_key;
    return;
  end if;
  if coalesce(current_revision, 0) <> p_expected_revision then
    raise exception 'Progress changed; reload and retry' using errcode = '40001';
  end if;
  if (p_progress->>'review_revision')::bigint <= p_expected_revision then
    raise exception 'Review revision must advance' using errcode = '22023';
  end if;
  if current_revision is null then
    insert into public.user_card_progress(user_id, note_id, card_key, due, fsrs, last_rating, review_revision)
    values(v_user, p_note_id, p_card_key, (p_progress->>'due')::timestamptz,
      p_progress->'fsrs', (p_progress->>'last_rating')::smallint, (p_progress->>'review_revision')::bigint);
  else
    update public.user_card_progress set due = (p_progress->>'due')::timestamptz,
      fsrs = p_progress->'fsrs', last_rating = (p_progress->>'last_rating')::smallint,
      review_revision = (p_progress->>'review_revision')::bigint
    where user_id = v_user and note_id = p_note_id and card_key = p_card_key;
  end if;
  for item in select value from jsonb_array_elements(p_logs) loop
    if item->>'note_id' is distinct from p_note_id::text or item->>'card_key' is distinct from p_card_key then
      raise exception 'Log does not belong to this card' using errcode = '22023';
    end if;
    if not exists(select 1 from public.review_logs where id = (item->>'id')::uuid and user_id = v_user) then
      insert into public.review_logs(id, user_id, note_id, card_key, reviewed_at, log)
      values((item->>'id')::uuid, v_user, p_note_id, p_card_key, (item->>'reviewed_at')::timestamptz, item->'log');
    end if;
  end loop;
  return query select * from public.user_card_progress
    where user_id = v_user and note_id = p_note_id and card_key = p_card_key;
end;
$$;
revoke all on function public.save_card_review(uuid,text,bigint,jsonb,jsonb) from public, anon;
grant execute on function public.save_card_review(uuid,text,bigint,jsonb,jsonb) to authenticated;
commit;
