-- Fixes 20261111000002: the target now comes from student_subjects (the sum of the subject targets).
-- Admin: the people who have signed up, and what each one has done.
-- Service role only, like the other admin functions. Guests (no profile, not onboarded) are counted, not listed.

create or replace function public.admin_users(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz := now() - make_interval(days => v_days);
  v_users jsonb;
  v_total int;
begin
  select count(*) into v_total from public.profiles where onboarded_at is not null;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.last_active desc nulls last, r.joined desc), '[]'::jsonb) into v_users
  from (
    select
      p.id,
      p.display_name as name,
      u.email,
      p.created_at as joined,
      u.last_sign_in_at as last_sign_in,
      coalesce(g.last_practice_day::timestamptz, u.last_sign_in_at) as last_active,
      coalesce(g.xp, 0) as xp,
      coalesce(g.current_streak, 0) as streak,
      coalesce(g.sessions_completed, 0) as sessions,
      coalesce(g.questions_answered, 0) as questions,
      (select count(*) from public.practice_sessions s where s.user_id = p.id and s.started_at >= v_since) as rounds_in_period,
      t.target,
      exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id) as reminders
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.player_progress g on g.user_id = p.id
    left join (select user_id, sum(target_score)::int as target from public.student_subjects group by user_id) t on t.user_id = p.id
    where p.onboarded_at is not null
    order by coalesce(g.last_practice_day::timestamptz, u.last_sign_in_at) desc nulls last, p.created_at desc
    limit 1000
  ) r;

  return jsonb_build_object(
    'days', v_days,
    'total', v_total,
    'joined_in_period', (select count(*) from public.profiles where onboarded_at is not null and created_at >= v_since),
    'active_in_period', (select count(distinct s.user_id) from public.practice_sessions s join public.profiles p on p.id = s.user_id
                         where p.onboarded_at is not null and s.started_at >= v_since),
    'users', v_users
  );
end;
$$;

-- One person: subjects, accuracy per subject, and their latest rounds.
create or replace function public.admin_user_detail(p_user uuid, p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz := now() - make_interval(days => v_days);
  v_profile jsonb;
  v_daily jsonb;
  v_recent jsonb;
begin
  select jsonb_build_object(
    'id', p.id, 'name', p.display_name, 'email', u.email, 'joined', p.created_at, 'onboarded_at', p.onboarded_at,
    'last_sign_in', u.last_sign_in_at, 'target', t.target,
    'xp', coalesce(g.xp, 0), 'streak', coalesce(g.current_streak, 0), 'best_streak', coalesce(g.best_streak, 0),
    'sessions', coalesce(g.sessions_completed, 0), 'questions', coalesce(g.questions_answered, 0),
    'last_practice_day', g.last_practice_day,
    'subjects', coalesce(g.subjects, '{}'::jsonb),
    'chosen', coalesce((select jsonb_agg(ss.subject_id order by ss.subject_id) from public.student_subjects ss where ss.user_id = p.id), '[]'::jsonb),
    'reminders', exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id)
  ) into v_profile
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.player_progress g on g.user_id = p.id
  left join (select user_id, sum(target_score)::int as target from public.student_subjects group by user_id) t on t.user_id = p.id
  where p.id = p_user;

  if v_profile is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('day', x.day, 'rounds', x.rounds) order by x.day), '[]'::jsonb) into v_daily
  from (
    select (s.started_at at time zone 'Africa/Lagos')::date as day, count(*) as rounds
    from public.practice_sessions s where s.user_id = p_user and s.started_at >= v_since group by 1
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc), '[]'::jsonb) into v_recent
  from (
    select s.mode::text as mode, s.status::text as status, s.started_at, s.question_count as total,
           s.answered_count as answered, s.accuracy, s.utme_score, s.duration_sec
    from public.practice_sessions s where s.user_id = p_user order by s.started_at desc limit 15
  ) x;

  return jsonb_build_object('days', v_days, 'user', v_profile, 'daily', v_daily, 'recent', v_recent);
end;
$$;

revoke execute on function public.admin_users(int), public.admin_user_detail(uuid, int) from public, anon, authenticated;
grant execute on function public.admin_users(int), public.admin_user_detail(uuid, int) to service_role;
