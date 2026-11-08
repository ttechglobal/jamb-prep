-- Server-authoritative practice engine. The client never sees a correct answer or
-- explanation until it has earned it, and every rule below is decided here, not in the browser.
-- Game values mirror lib/game/rules.ts; keep the two in step.

create function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  return v_user;
end;
$$;

create function private.is_guest()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- Total XP to reach level n is 50 * n * (n - 1); this is its inverse.
create function private.level_for(p_xp int)
returns int
language sql
immutable
set search_path = ''
as $$
  select floor((1 + sqrt(1 + greatest(p_xp, 0) / 12.5)) / 2)::int;
$$;

create function private.public_question(q public.questions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', q.id,
    'subjectId', q.subject_id,
    'topicId', q.topic_id,
    'body', q.body,
    'passage', q.passage,
    'imagePath', q.image_path,
    'options', q.options
  );
$$;

create function private.reveal(q public.questions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('questionId', q.id, 'correctOption', q.correct_option, 'explanation', q.explanation);
$$;

create function private.session_payload(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'config', s.config,
    'status', s.status,
    'startedAt', s.started_at,
    'deadlineAt', s.deadline_at,
    'questions', (
      select coalesce(jsonb_agg(
        jsonb_build_object('position', sq.position, 'question', private.public_question(q))
        order by sq.position
      ), '[]'::jsonb)
      from public.practice_session_questions sq
      join public.questions q on q.id = sq.question_id
      where sq.session_id = s.id
    ),
    'answers', (
      select coalesce(jsonb_object_agg(a.question_id::text, a.selected_option), '{}'::jsonb)
      from public.practice_answers a
      where a.session_id = s.id
    ),
    'reveals', case when s.feedback = 'instant' then (
      select coalesce(jsonb_object_agg(a.question_id::text, private.reveal(q)), '{}'::jsonb)
      from public.practice_answers a
      join public.questions q on q.id = a.question_id
      where a.session_id = s.id
    ) else '{}'::jsonb end
  )
  from public.practice_sessions s
  where s.id = p_id;
$$;

-- Only called for closed sessions: this is the one place answers leave the database in bulk.
create function private.result_payload(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'sessionId', s.id,
    'config', s.config,
    'total', s.question_count,
    'answered', s.answered_count,
    'correct', s.correct_count,
    'accuracy', s.accuracy,
    'durationSec', s.duration_sec,
    'bySubject', s.per_subject,
    'utmeScore', s.utme_score,
    'reward', s.reward,
    'review', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'question', private.public_question(q),
          'selected', a.selected_option,
          'reveal', private.reveal(q)
        )
        order by sq.position
      ), '[]'::jsonb)
      from public.practice_session_questions sq
      join public.questions q on q.id = sq.question_id
      left join public.practice_answers a
        on a.session_id = sq.session_id and a.question_id = sq.question_id
      where sq.session_id = s.id
    )
  )
  from public.practice_sessions s
  where s.id = p_id;
$$;

create function private.pick_questions(p_user uuid, p_subject text, p_topic uuid, p_count int)
returns setof uuid
language sql
volatile
set search_path = ''
as $$
  select q.id
  from public.questions q
  left join lateral (
    select 1 as seen
    from public.practice_answers a
    where a.user_id = p_user
      and a.question_id = q.id
      and a.answered_at > now() - interval '14 days'
    limit 1
  ) recent on true
  where q.subject_id = p_subject
    and q.status = 'published'
    and (p_topic is null or q.topic_id = p_topic)
  order by recent.seen nulls first, random()
  limit p_count;
$$;

create function private.finalise_session(p_id uuid, p_status public.session_status)
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
    else v_correct * 10 + (v_answered - v_correct) * 2 + 10 + case when v_stars = 3 then 10 else 0 end
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

-- Client API ----------------------------------------------------------------

create function public.complete_onboarding(p_display_name text, p_subject_ids text[], p_target_score int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_compulsory text;
  v_count int;
begin
  if private.is_guest() then
    raise exception 'account_required' using errcode = 'P0001';
  end if;

  select compulsory_subject_id, (rules ->> 'subject_count')::int
  into v_compulsory, v_count
  from public.exam_formats
  where active;

  if p_subject_ids is null
    or cardinality(p_subject_ids) <> v_count
    or (select count(distinct x) from unnest(p_subject_ids) x) <> v_count
    or not v_compulsory = any (p_subject_ids)
    or (select count(*) from public.subjects where active and id = any (p_subject_ids)) <> v_count
  then
    raise exception 'invalid_subjects' using errcode = 'P0001';
  end if;

  if p_target_score is null or p_target_score not between 0 and 400 then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;

  update public.profiles
  set display_name = trim(p_display_name),
      onboarded_at = coalesce(onboarded_at, now())
  where id = v_user;

  delete from public.student_subjects where user_id = v_user;
  insert into public.student_subjects (user_id, subject_id)
  select v_user, x from unnest(p_subject_ids) x;

  insert into public.student_goals (user_id, target_score)
  values (v_user, p_target_score)
  on conflict (user_id) do update set target_score = excluded.target_score;
end;
$$;

create function public.count_questions(p_subject_id text, p_topic_id uuid default null)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.questions
  where subject_id = p_subject_id
    and status = 'published'
    and (p_topic_id is null or topic_id = p_topic_id);
$$;

create function public.start_session(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_mode_text text := p_config ->> 'mode';
  v_mode public.practice_mode;
  v_subjects text[];
  v_topic uuid;
  v_count int;
  v_duration int;
  v_feedback text;
  v_format public.exam_formats;
  v_session uuid := gen_random_uuid();
  v_config jsonb;
  v_subject text;
  v_want int;
  v_got int;
  v_position int := 0;
begin
  if (
    select count(*) from public.practice_sessions
    where user_id = v_user and started_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if v_mode_text is null or v_mode_text not in ('quick_five', 'subject', 'timed', 'mock') then
    raise exception 'invalid_mode' using errcode = 'P0001';
  end if;
  v_mode := v_mode_text::public.practice_mode;

  -- Set here, not read from the client, so a timed session can't request instant answers.
  v_feedback := case when v_mode in ('quick_five', 'subject') then 'instant' else 'end' end;

  if v_mode = 'mock' then
    if private.is_guest() then
      raise exception 'account_required' using errcode = 'P0001';
    end if;

    select * into v_format from public.exam_formats where active;
    if not found then
      raise exception 'no_exam_format' using errcode = 'P0001';
    end if;

    select array_agg(ss.subject_id order by sub.is_compulsory desc, sub.sort_order)
    into v_subjects
    from public.student_subjects ss
    join public.subjects sub on sub.id = ss.subject_id
    where ss.user_id = v_user;

    if coalesce(cardinality(v_subjects), 0) <> (v_format.rules ->> 'subject_count')::int then
      raise exception 'onboarding_required' using errcode = 'P0001';
    end if;

    v_duration := v_format.total_duration_sec;
  else
    v_subjects := array[p_config -> 'subjectIds' ->> 0];
    if not exists (select 1 from public.subjects where id = v_subjects[1] and active) then
      raise exception 'invalid_subject' using errcode = 'P0001';
    end if;

    v_topic := nullif(p_config ->> 'topicId', '')::uuid;
    if v_topic is not null and not exists (
      select 1 from public.topics where id = v_topic and subject_id = v_subjects[1]
    ) then
      raise exception 'invalid_topic' using errcode = 'P0001';
    end if;

    if v_mode = 'quick_five' then
      v_count := 5;
      v_topic := null;
    else
      v_count := (p_config ->> 'count')::int;
      if v_count is null or v_count not between 1 and 100 then
        raise exception 'invalid_count' using errcode = 'P0001';
      end if;
    end if;

    if v_mode = 'timed' then
      v_duration := (p_config ->> 'durationSec')::int;
      if v_duration is null or v_duration not between 60 and 10800 then
        raise exception 'invalid_duration' using errcode = 'P0001';
      end if;
    end if;
  end if;

  insert into public.practice_sessions (id, user_id, mode, config, feedback, deadline_at, question_count)
  values (
    v_session, v_user, v_mode, '{}'::jsonb, v_feedback,
    case when v_duration is not null then now() + make_interval(secs => v_duration) end,
    0
  );

  foreach v_subject in array v_subjects loop
    v_want := case
      when v_mode <> 'mock' then v_count
      when v_subject = v_format.compulsory_subject_id then (v_format.rules ->> 'compulsory_question_count')::int
      else (v_format.rules ->> 'other_question_count')::int
    end;

    insert into public.practice_session_questions (session_id, position, question_id, subject_id)
    select v_session, v_position + row_number() over (), id, v_subject
    from private.pick_questions(v_user, v_subject, v_topic, v_want) as id;

    get diagnostics v_got = row_count;
    if v_got = 0 then
      raise exception 'no_questions' using errcode = 'P0001';
    end if;
    if v_mode = 'mock' and v_got < v_want then
      raise exception 'insufficient_questions' using errcode = 'P0001';
    end if;
    v_position := v_position + v_got;
  end loop;

  v_config := jsonb_build_object(
    'mode', v_mode,
    'subjectIds', to_jsonb(v_subjects),
    'topicId', v_topic,
    'count', v_position,
    'durationSec', v_duration,
    'feedback', v_feedback
  );
  if v_mode = 'mock' then
    v_config := v_config || jsonb_build_object('maxPerSubject', (v_format.rules ->> 'max_per_subject')::int);
  end if;

  update public.practice_sessions
  set config = v_config, question_count = v_position
  where id = v_session;

  return private.session_payload(v_session);
end;
$$;

create function public.get_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  s public.practice_sessions;
begin
  select * into s from public.practice_sessions where id = p_session_id and user_id = v_user;
  if not found then
    return null;
  end if;
  if s.status = 'in_progress' and s.deadline_at < now() then
    perform private.finalise_session(s.id, 'expired');
  end if;
  return private.session_payload(s.id);
end;
$$;

create function public.save_answer(p_session_id uuid, p_question_id uuid, p_option text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  s public.practice_sessions;
  q public.questions;
begin
  if p_option is null or p_option not in ('A', 'B', 'C', 'D') then
    raise exception 'invalid_option' using errcode = 'P0001';
  end if;

  select * into s from public.practice_sessions where id = p_session_id and user_id = v_user for update;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;

  -- Five seconds' grace for answers delayed by a slow network.
  if s.status <> 'in_progress' or s.deadline_at + interval '5 seconds' < now() then
    raise exception 'session_closed' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.practice_session_questions
    where session_id = p_session_id and question_id = p_question_id
  ) then
    raise exception 'question_not_in_session' using errcode = 'P0001';
  end if;

  select * into q from public.questions where id = p_question_id;

  if s.feedback = 'instant' then
    -- Once revealed, an answer is locked.
    insert into public.practice_answers (session_id, question_id, user_id, selected_option)
    values (p_session_id, p_question_id, v_user, p_option)
    on conflict (session_id, question_id) do nothing;
    return jsonb_build_object('reveal', private.reveal(q));
  end if;

  insert into public.practice_answers (session_id, question_id, user_id, selected_option)
  values (p_session_id, p_question_id, v_user, p_option)
  on conflict (session_id, question_id)
  do update set selected_option = excluded.selected_option, answered_at = now();

  return '{}'::jsonb;
end;
$$;

create function public.submit_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  s public.practice_sessions;
begin
  select * into s from public.practice_sessions where id = p_session_id and user_id = v_user;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;

  if s.status = 'in_progress' then
    perform private.finalise_session(
      s.id,
      case when s.deadline_at < now() then 'expired' else 'submitted' end::public.session_status
    );
  end if;

  return private.result_payload(s.id);
end;
$$;

create function public.get_results(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  s public.practice_sessions;
begin
  select * into s from public.practice_sessions where id = p_session_id and user_id = v_user;
  if not found then
    return null;
  end if;

  if s.status = 'in_progress' then
    if s.deadline_at < now() then
      perform private.finalise_session(s.id, 'expired');
    else
      return null;
    end if;
  end if;

  return private.result_payload(s.id);
end;
$$;
