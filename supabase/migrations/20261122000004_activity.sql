-- Questions and rounds per day for the Progress page. Days are Lagos days, and days with no practice
-- are returned as zeros so the chart has no gaps. Only the student's own answers are read.
--
-- Not applied to the database yet. Review, then apply.

create function public.get_activity(p_days int default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
  v_days int := least(greatest(coalesce(p_days, 14), 1), 60);
  v_today date := private.lagos_today();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('day', d.day, 'questions', coalesce(a.questions, 0), 'rounds', coalesce(a.rounds, 0)) order by d.day)
    from generate_series(v_today - (v_days - 1), v_today, interval '1 day') as g(ts)
    cross join lateral (select g.ts::date as day) d
    left join (
      select (answered_at at time zone 'Africa/Lagos')::date as day,
             count(*)::int as questions,
             count(distinct session_id)::int as rounds
      from public.practice_answers
      where user_id = v_user
        and answered_at >= (v_today - (v_days - 1))::timestamp at time zone 'Africa/Lagos'
      group by 1
    ) a on a.day = d.day
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_activity(int) to authenticated;
