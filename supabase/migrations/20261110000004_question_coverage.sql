-- Read-only numbers for the admin Question coverage page.
-- Both functions are callable by the service role only, like the other admin functions.

-- What the bank holds for each subject and year, plus what MyQuest papers are already fetched,
-- so nothing is fetched twice.
create function public.admin_question_coverage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'cells', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject_id', subject_id,
        'year', year,
        'published', published,
        'draft', draft
      ) order by subject_id, year)
      from (
        select
          subject_id,
          year,
          count(*) filter (where status = 'published')::int as published,
          count(*) filter (where status = 'draft')::int as draft
        from public.questions
        where year is not null and status <> 'retired'
        group by subject_id, year
      ) c
    ), '[]'::jsonb),
    'staged', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject_id', subject_id,
        'provider_subject', provider_subject,
        'year', provider_year,
        'status', status,
        'fetched', fetched_total
      ) order by provider_subject, provider_year)
      from public.import_papers
    ), '[]'::jsonb)
  );
$$;

-- How often each topic appears, by subject and year. Questions without a topic are counted apart,
-- so a subject that is not tagged yet shows as that and not as an empty chart.
create function public.admin_topic_frequency()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(s order by s ->> 'subject_id'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'subject_id', q.subject_id,
      'total', count(*)::int,
      'tagged', count(q.topic_id)::int,
      'first_year', min(q.year),
      'last_year', max(q.year),
      'years', (
        select jsonb_agg(jsonb_build_object('year', y.year, 'total', y.n) order by y.year)
        from (select year, count(*)::int as n from public.questions
              where subject_id = q.subject_id and year is not null and status <> 'retired'
              group by year) y
      ),
      'topics', coalesce((
        select jsonb_agg(t order by (t ->> 'count')::int desc, t ->> 'name')
        from (
          select jsonb_build_object(
            'topic_id', tp.id,
            'name', tp.name,
            'count', count(*)::int,
            'by_year', (
              select jsonb_object_agg(z.year, z.n)
              from (select qq.year, count(*)::int as n from public.questions qq
                    where qq.topic_id = tp.id and qq.year is not null and qq.status <> 'retired'
                    group by qq.year) z
            )
          ) as t
          from public.questions qq2
          join public.topics tp on tp.id = qq2.topic_id
          where qq2.subject_id = q.subject_id and qq2.status <> 'retired'
          group by tp.id, tp.name
        ) x
      ), '[]'::jsonb)
    ) as s
    from public.questions q
    where q.status <> 'retired'
    group by q.subject_id
  ) r;
$$;

revoke execute on function public.admin_question_coverage(), public.admin_topic_frequency() from public, anon, authenticated;
grant execute on function public.admin_question_coverage(), public.admin_topic_frequency() to service_role;
