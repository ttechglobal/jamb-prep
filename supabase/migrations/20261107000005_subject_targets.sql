-- Students now set a target per subject (out of 100). The total out of 400 is their sum,
-- so it is calculated, not stored. student_goals held no data when this was applied.

alter table public.student_subjects
  add column target_score int not null default 70 check (target_score between 0 and 100);

drop function public.complete_onboarding(text, text[], int);
drop table public.student_goals;

create function public.complete_onboarding(p_display_name text, p_subject_targets jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_name text := trim(coalesce(p_display_name, ''));
  v_compulsory text;
  v_count int;
  v_max int;
  v_subjects text[];
begin
  if private.is_guest() then
    raise exception 'account_required' using errcode = 'P0001';
  end if;

  if length(v_name) not between 2 and 30 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;

  if p_subject_targets is null or jsonb_typeof(p_subject_targets) <> 'object' then
    raise exception 'invalid_subjects' using errcode = 'P0001';
  end if;

  select compulsory_subject_id, (rules ->> 'subject_count')::int, (rules ->> 'max_per_subject')::int
  into v_compulsory, v_count, v_max
  from public.exam_formats
  where active;

  select array_agg(k) into v_subjects from jsonb_object_keys(p_subject_targets) k;

  if coalesce(cardinality(v_subjects), 0) <> v_count
    or not v_compulsory = any (v_subjects)
    or (select count(*) from public.subjects where active and id = any (v_subjects)) <> v_count
  then
    raise exception 'invalid_subjects' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_each(p_subject_targets) e
    where jsonb_typeof(e.value) <> 'number'
      or (e.value #>> '{}')::numeric not between 0 and v_max
      or (e.value #>> '{}')::numeric % 1 <> 0
  ) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;

  update public.profiles
  set display_name = v_name,
      onboarded_at = coalesce(onboarded_at, now())
  where id = v_user;

  delete from public.student_subjects where user_id = v_user;
  insert into public.student_subjects (user_id, subject_id, target_score)
  select v_user, e.key, (e.value #>> '{}')::int
  from jsonb_each(p_subject_targets) e;
end;
$$;

revoke all on function public.complete_onboarding(text, jsonb) from public, anon, authenticated;
grant execute on function public.complete_onboarding(text, jsonb) to authenticated;
