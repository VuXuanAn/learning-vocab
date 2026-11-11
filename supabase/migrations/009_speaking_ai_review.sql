alter table public.speaking_recordings add column if not exists ai_review jsonb;
alter table public.speaking_recordings drop constraint if exists valid_speaking_ai_review;
alter table public.speaking_recordings add constraint valid_speaking_ai_review check (
 ai_review is null or (jsonb_typeof(ai_review)='object' and octet_length(ai_review::text)<=262144)
);
-- Existing owner update policies protect AI reports. Human reviewer feedback
-- remains separate in shadowing_reviews; this column stores AI coaching only.
