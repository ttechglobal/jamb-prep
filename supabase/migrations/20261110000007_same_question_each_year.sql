-- The same question can appear in more than one exam year, and each year keeps its own copy, so
-- the bank records how often a question and its topic come up. Two copies in the same year are
-- still refused.

alter table public.questions drop constraint questions_content_hash_key;

-- nulls not distinct: two questions with no year and the same content still count as a duplicate.
create unique index questions_content_hash_year_key
  on public.questions (content_hash, year) nulls not distinct;

-- Practice must never show the same question twice in one round, so it picks one copy per question.
-- A question counts as recently seen if the student answered any copy of it.
create or replace function private.pick_questions(p_user uuid, p_subject text, p_topic uuid, p_count int)
returns setof uuid
language sql
volatile
set search_path = ''
as $$
  select d.id
  from (
    select distinct on (q.content_hash)
      q.id,
      q.content_hash,
      exists (
        select 1
        from public.practice_answers a
        join public.questions q2 on q2.id = a.question_id
        where a.user_id = p_user
          and q2.content_hash = q.content_hash
          and a.answered_at > now() - interval '14 days'
      ) as seen
    from public.questions q
    where q.subject_id = p_subject
      and q.status = 'published'
      and (p_topic is null or q.topic_id = p_topic)
    order by q.content_hash, random()
  ) d
  order by d.seen, random()
  limit p_count;
$$;
