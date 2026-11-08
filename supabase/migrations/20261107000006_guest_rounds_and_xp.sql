-- Guests get two rounds, then must create an account. Counted on every session start,
-- so abandoning a round doesn't refund it.
create function private.enforce_guest_rounds()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_guest() and (
    select count(*) from public.practice_sessions where user_id = new.user_id
  ) >= 2 then
    raise exception 'account_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_guest_rounds() from public, anon, authenticated;

create trigger practice_sessions_guest_rounds before insert on public.practice_sessions
  for each row execute function private.enforce_guest_rounds();

-- XP: 2 per correct answer, 2 for finishing, 2 more for three stars. Mirrors lib/game/rules.ts.
create or replace function private.finalise_session(p_id uuid, p_status public.session_status)
returns void
language plpgsql
set search_path = ''
as $$
declare
  s public.practice_sessions;
  p public.player_progress;
  r record;
  v_mock boolean;
  v_max int;
  v_total int;
  v_answered int;
  v_correct int;
  v_accuracy int;
  v_per jsonb;
  v_utme int;
  v_xp int;
  v_stars int;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_streak int;
  v_before int;
  v_after int;
  v_subjects jsonb;
  v_row jsonb;
begin
  select * into s from public.practice_sessions where id = p_id for update;
  if not found or s.status <> 'in_progress' then
    return;
  end if;

  update public.practice_answers a
  set is_correct = (a.selected_option = q.correct_option)
  from public.questions q
  where a.session_id = p_id and q.id = a.question_id;

  select count(*), count(a.question_id), count(*) filter (where a.is_correct)
  into v_total, v_answered, v_correct
  from public.practice_session_questions sq
  left join public.practice_answers a
    on a.session_id = sq.session_id and a.question_id = sq.question_id
  where sq.session_id = p_id;

  v_accuracy := case when v_total = 0 then 0 else round(v_correct * 100.0 / v_total) end;
  v_mock := s.mode = 'mock';
  v_max := coalesce((s.config ->> 'maxPerSubject')::int, 100);

  select
    coalesce(jsonb_agg(
      jsonb_build_object('subjectId', x.subject_id, 'total', x.total, 'correct', x.correct, 'answered', x.answered)
      || case when v_mock then jsonb_build_object('scaledScore', x.scaled) else '{}'::jsonb end
      order by x.first_position
    ), '[]'::jsonb),
    case when v_mock then coalesce(sum(x.scaled), 0)::int end
  into v_per, v_utme
  from (
    select
      sq.subject_id,
      min(sq.position) as first_position,
      count(*)::int as total,
      count(a.question_id)::int as answered,
      (count(*) filter (where a.is_correct))::int as correct,
      round((count(*) filter (where a.is_correct)) * v_max::numeric / count(*))::int as scaled
    from public.practice_session_questions sq
    left join public.practice_answers a
      on a.session_id = sq.session_id and a.question_id = sq.question_id
    where sq.session_id = p_id
    group by sq.subject_id
  ) x;

  v_stars := case
    when v_accuracy >= 90 then 3
    when v_accuracy >= 70 then 2
    when v_accuracy >= 40 then 1
    else 0
  end;

  v_xp := case when v_answered = 0 then 0
    else v_correct * 2 + 2 + case when v_stars = 3 then 2 else 0 end
  end;

  insert into public.player_progress (user_id) values (s.user_id) on conflict do nothing;
  select * into p from public.player_progress where user_id = s.user_id for update;

  v_streak := case
    when p.last_practice_day is not null and v_today - p.last_practice_day <= 1 then p.current_streak
    else 0
  end;
  if v_answered > 0 and p.last_practice_day is distinct from v_today then
    v_streak := v_streak + 1;
  end if;

  v_subjects := p.subjects;
  for r in select value from jsonb_array_elements(v_per) loop
    v_row := v_subjects -> (r.value ->> 'subjectId');
    v_subjects := v_subjects || jsonb_build_object(
      r.value ->> 'subjectId',
      jsonb_build_object(
        'answered', coalesce((v_row ->> 'answered')::int, 0) + (r.value ->> 'answered')::int,
        'correct', coalesce((v_row ->> 'correct')::int, 0) + (r.value ->> 'correct')::int
      )
    );
  end loop;

  v_before := private.level_for(p.xp);
  v_after := private.level_for(p.xp + v_xp);

  update public.player_progress
  set xp = p.xp + v_xp,
      current_streak = v_streak,
      best_streak = greatest(p.best_streak, v_streak),
      last_practice_day = case when v_answered > 0 then v_today else p.last_practice_day end,
      day_questions = case
        when v_answered = 0 then p.day_questions
        when p.last_practice_day = v_today then p.day_questions + v_answered
        else v_answered
      end,
      sessions_completed = p.sessions_completed + 1,
      questions_answered = p.questions_answered + v_answered,
      subjects = v_subjects
  where user_id = s.user_id;

  update public.practice_sessions
  set status = p_status,
      submitted_at = now(),
      answered_count = v_answered,
      correct_count = v_correct,
      accuracy = v_accuracy,
      duration_sec = greatest(0, round(extract(epoch from least(now(), s.deadline_at) - s.started_at)))::int,
      utme_score = v_utme,
      per_subject = v_per,
      reward = jsonb_build_object(
        'sessionId', s.id,
        'xpGained', v_xp,
        'stars', v_stars,
        'levelBefore', v_before,
        'levelAfter', v_after,
        'streak', v_streak
      )
  where id = p_id;
end;
$$;
