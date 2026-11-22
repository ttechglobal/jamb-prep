-- 1. "Work on this" trends: a plain read of the student's last 14 days, per topic.
-- 2. Question picking leans toward topics the bank holds more past questions for (the bank keeps one
--    row per exam year, so a topic's published row count is how often it comes up).
--
-- Not applied to the database yet. Review, then apply.

-- Trends -------------------------------------------------------------------
-- Looks only at answers from the last 14 days, counting the last 7 twice as much. A topic needs at
-- least 5 scored answers before it can appear, so one bad question never labels a topic.
--   improving : at least 3 answers in each week and accuracy up 15 points or more on the week before
--   work_on   : weighted accuracy under 60%
-- Anything else is left out. No strong/weak labels and no percentages leave this function.

create function public.get_topic_trends()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  return coalesce((
    with recent as (
      select
        q.topic_id,
        count(*) filter (where a.answered_at > now() - interval '7 days') as n7,
        count(*) filter (where a.answered_at > now() - interval '7 days' and a.is_correct) as c7,
        count(*) filter (where a.answered_at <= now() - interval '7 days') as n14,
        count(*) filter (where a.answered_at <= now() - interval '7 days' and a.is_correct) as c14
      from public.practice_answers a
      join public.questions q on q.id = a.question_id
      where a.user_id = v_user
        and a.answered_at > now() - interval '14 days'
        and a.is_correct is not null
        and q.topic_id is not null
      group by q.topic_id
      having count(*) >= 5
    ),
    freq as (
      select
        q.topic_id,
        percent_rank() over (partition by q.subject_id order by count(*)) as rank
      from public.questions q
      where q.status = 'published' and q.topic_id is not null
      group by q.subject_id, q.topic_id
    ),
    scored as (
      select
        r.topic_id,
        t.name,
        t.subject_id,
        r.n7 + r.n14 as attempts,
        (2 * r.c7 + r.c14)::numeric / (2 * r.n7 + r.n14) as score,
        (r.n7 >= 3 and r.n14 >= 3
          and r.c7::numeric / r.n7 - r.c14::numeric / r.n14 >= 0.15) as is_improving,
        coalesce(f.rank, 0) >= 0.67 as is_frequent
      from recent r
      join public.topics t on t.id = r.topic_id and t.active
      left join freq f on f.topic_id = r.topic_id
    ),
    labelled as (
      select *, case when is_improving then 'improving' when score < 0.6 then 'work_on' end as status
      from scored
    )
    select jsonb_agg(
      jsonb_build_object(
        'topicId', topic_id,
        'topicName', name,
        'subjectId', subject_id,
        'status', status,
        'frequent', is_frequent,
        'attempts', attempts
      )
      order by (status = 'work_on') desc, is_frequent desc, score asc
    )
    from (select * from labelled where status is not null order by (status = 'work_on') desc, is_frequent desc, score asc limit 8) top
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_topic_trends() to authenticated;

-- Question picking ---------------------------------------------------------
-- Same rules as before (one copy per question, recently answered questions go last), plus a weighted
-- random order: each question is ranked by -ln(u) / weight, so a heavier topic is picked more often
-- but never every time. Each question's weight is the square root of its topic's published row
-- count, so a topic's overall share grows with its size to the power 1.5. Checked on physics with
-- 300 draws of five: the biggest topic (12% of the bank) came up about 19% of the time, and the
-- sixth biggest (4%) about 3.6%. Questions with no topic weigh 1. When a single topic is chosen
-- every question has the same weight, so topic practice is unchanged.

create or replace function private.pick_questions(p_user uuid, p_subject text, p_topic uuid, p_count int)
returns setof uuid
language sql
volatile
set search_path = ''
as $$
  select d.id
  from (
    select distinct on (p.content_hash)
      p.id,
      p.content_hash,
      p.weight,
      exists (
        select 1
        from public.practice_answers a
        join public.questions q2 on q2.id = a.question_id
        where a.user_id = p_user
          and q2.content_hash = p.content_hash
          and a.answered_at > now() - interval '14 days'
      ) as seen
    from (
      select
        q.id,
        q.content_hash,
        case
          when q.topic_id is null then 1.0
          else sqrt(greatest(count(*) over (partition by q.topic_id), 1))
        end as weight
      from public.questions q
      where q.subject_id = p_subject
        and q.status = 'published'
        and (p_topic is null or q.topic_id = p_topic)
    ) p
    order by p.content_hash, random()
  ) d
  order by d.seen, -ln(1 - random()) / d.weight
  limit p_count;
$$;
