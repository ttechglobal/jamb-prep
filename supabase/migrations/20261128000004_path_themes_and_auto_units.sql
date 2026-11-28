-- Path, round two:
--   1. Themes. Syllabus order is grouped by theme ("Algebra", "Mechanics") instead of "Part 1".
--   2. Adding topics is automatic. A new active topic in a subject that already has a path gets a unit of
--      its own, shown under "More topics" until someone groups it. New questions need nothing: counts are live.
--   3. A unit with fewer than 5 published questions stays off the path until it has them.
--   4. Home gets the whole trail (a dot per unit) so the card can show a preview.

alter table public.path_units
  add column theme text,
  add column theme_order int;

-- Themes for the seeded subjects ---------------------------------------------

with t(subject_id, unit_slug, theme, theme_order) as (values
  ('mathematics', 'bases-sets-operations-matrices', 'Number and sets', 1),
  ('mathematics', 'fractions-decimals-percentages', 'Number and sets', 1),
  ('mathematics', 'indices-logarithms-surds', 'Number and sets', 1),
  ('mathematics', 'polynomials-equations', 'Algebra', 2),
  ('mathematics', 'variation-inequalities', 'Algebra', 2),
  ('mathematics', 'progression', 'Algebra', 2),
  ('mathematics', 'euclidean-geometry', 'Geometry and trigonometry', 3),
  ('mathematics', 'mensuration', 'Geometry and trigonometry', 3),
  ('mathematics', 'coordinate-geometry', 'Geometry and trigonometry', 3),
  ('mathematics', 'trigonometry', 'Geometry and trigonometry', 3),
  ('mathematics', 'calculus-loci-counting', 'Calculus, statistics and probability', 4),
  ('mathematics', 'statistics', 'Calculus, statistics and probability', 4),
  ('mathematics', 'probability', 'Calculus, statistics and probability', 4),

  ('physics', 'measurements-and-motion', 'Mechanics', 1),
  ('physics', 'gravity-forces-machines', 'Mechanics', 1),
  ('physics', 'work-energy-power', 'Mechanics', 1),
  ('physics', 'pressure-and-liquids', 'Mechanics', 1),
  ('physics', 'temperature-and-heat', 'Heat and gases', 2),
  ('physics', 'gases-matter-heat-transfer', 'Heat and gases', 2),
  ('physics', 'waves-and-sound', 'Waves, sound and light', 3),
  ('physics', 'light-reflection-refraction', 'Waves, sound and light', 3),
  ('physics', 'optical-instruments-colour', 'Waves, sound and light', 3),
  ('physics', 'electrostatics-capacitors', 'Electricity and magnetism', 4),
  ('physics', 'current-electricity', 'Electricity and magnetism', 4),
  ('physics', 'magnetism-induction', 'Electricity and magnetism', 4),
  ('physics', 'conduction-electronics', 'Electronics and modern physics', 5),
  ('physics', 'modern-physics', 'Electronics and modern physics', 5),

  ('chemistry', 'separation-and-combination', 'Matter and structure', 1),
  ('chemistry', 'kinetic-theory-gas-laws', 'Matter and structure', 1),
  ('chemistry', 'atomic-structure-bonding', 'Matter and structure', 1),
  ('chemistry', 'solubility-pollution', 'Solutions and reactions', 2),
  ('chemistry', 'acids-bases-salts', 'Solutions and reactions', 2),
  ('chemistry', 'redox-electrolysis', 'Solutions and reactions', 2),
  ('chemistry', 'energy-rates-equilibria', 'Solutions and reactions', 2),
  ('chemistry', 'non-metals', 'Elements and compounds', 3),
  ('chemistry', 'metals-industry', 'Elements and compounds', 3),
  ('chemistry', 'organic-compounds', 'Organic chemistry', 4),

  ('biology', 'living-organisms-classification', 'Cells and living things', 1),
  ('biology', 'adaptations-internal-structure', 'Cells and living things', 1),
  ('biology', 'nutrition', 'Life processes', 2),
  ('biology', 'transport-respiration-excretion', 'Life processes', 2),
  ('biology', 'support-reproduction-growth', 'Life processes', 2),
  ('biology', 'coordination-control', 'Life processes', 2),
  ('biology', 'habitats-distribution-soil', 'Ecology', 3),
  ('biology', 'symbiosis-humans-environment', 'Ecology', 3),
  ('biology', 'genetics-evolution', 'Genetics and evolution', 4),

  ('accounting', 'nature-of-accounting-ethics', 'Accounting basics', 1),
  ('accounting', 'double-entry', 'Accounting basics', 1),
  ('accounting', 'cash-book-banking', 'Accounting basics', 1),
  ('accounting', 'sole-trader-final-accounts', 'Final accounts and records', 2),
  ('accounting', 'stock-control-accounts', 'Final accounts and records', 2),
  ('accounting', 'incomplete-records-non-profit', 'Final accounts and records', 2),
  ('accounting', 'manufacturing-accounts', 'Final accounts and records', 2),
  ('accounting', 'departmental-branch-joint-venture', 'Special accounts', 3),
  ('accounting', 'partnership-accounts', 'Special accounts', 3),
  ('accounting', 'company-public-sector', 'Special accounts', 3),

  ('commerce', 'commerce-occupation-production', 'Trade and its aids', 1),
  ('commerce', 'trade-and-sale-of-goods', 'Trade and its aids', 1),
  ('commerce', 'aids-to-trade', 'Trade and its aids', 1),
  ('commerce', 'business-units-associations', 'Business and money', 2),
  ('commerce', 'money-and-financing', 'Business and money', 2),
  ('commerce', 'exchanges', 'Business and money', 2),
  ('commerce', 'management', 'Business practice', 3),
  ('commerce', 'marketing', 'Business practice', 3),
  ('commerce', 'legal-aspects', 'Business practice', 3),
  ('commerce', 'business-environment', 'Business practice', 3),

  ('economics', 'economics-basics', 'Microeconomics', 1),
  ('economics', 'demand-consumer', 'Microeconomics', 1),
  ('economics', 'supply-price', 'Microeconomics', 1),
  ('economics', 'production-costs', 'Microeconomics', 1),
  ('economics', 'market-structures', 'Microeconomics', 1),
  ('economics', 'income-money-inflation', 'Macroeconomics', 2),
  ('economics', 'finance-public-finance', 'Macroeconomics', 2),
  ('economics', 'growth-population', 'Macroeconomics', 2),
  ('economics', 'nigerian-economy', 'Nigeria and the world', 3),
  ('economics', 'international', 'Nigeria and the world', 3)
)
update public.path_units pu
set theme = t.theme, theme_order = t.theme_order
from t
where pu.subject_id = t.subject_id and pu.slug = t.unit_slug;

do $$
begin
  if exists (select 1 from public.path_units where theme is null) then
    raise exception 'Every seeded unit needs a theme: %', (select string_agg(subject_id || '/' || slug, ', ') from public.path_units where theme is null);
  end if;
end;
$$;

-- New topics join the path on their own ---------------------------------------
-- Only for a subject that already has a path. A subject with none yet (for example English) is left
-- alone until it is set up on purpose. The new unit has no theme, so it lands under "More topics".

create function private.path_auto_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit uuid;
begin
  if new.active
     and exists (select 1 from public.path_units where subject_id = new.subject_id)
     and not exists (select 1 from public.path_unit_topics where topic_id = new.id) then
    insert into public.path_units (subject_id, slug, name, sort_order)
    values (
      new.subject_id,
      'topic-' || new.slug,
      new.name,
      coalesce((select max(sort_order) from public.path_units where subject_id = new.subject_id), 0) + 10
    )
    returning id into v_unit;
    insert into public.path_unit_topics (unit_id, topic_id) values (v_unit, new.id);
  end if;
  return new;
end;
$$;

create trigger topics_path_auto_unit
  after insert or update of active on public.topics
  for each row
  execute function private.path_auto_unit();

revoke all on function private.path_auto_unit() from public, anon, authenticated;

-- Reading the path ---------------------------------------------------------------
-- Same as before, plus themes, and units with fewer than 5 questions stay off the trail.

create or replace function private.path_subject(p_user uuid, p_subject text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with units as (
    select
      pu.id, pu.slug, pu.name, pu.sort_order, pu.theme, pu.theme_order,
      (
        select count(distinct q.content_hash)
        from public.path_unit_topics put
        join public.questions q on q.topic_id = put.topic_id and q.status = 'published'
        where put.unit_id = pu.id
      )::int as question_count
    from public.path_units pu
    where pu.subject_id = p_subject and pu.active
  ),
  live as (
    select * from units where question_count >= 5
  ),
  ranked as (
    select
      l.*,
      row_number() over (order by l.question_count desc, l.sort_order) as asked_rank,
      row_number() over (order by coalesce(l.theme_order, 999), l.sort_order) as syllabus_rank
    from live l
  ),
  ev as (
    select
      r.id as unit_id,
      count(a.question_id)::int as answers,
      count(distinct (a.answered_at at time zone 'Africa/Lagos')::date)::int as days,
      (count(*) filter (where a.answered_at > now() - interval '14 days'))::int as n14,
      (count(*) filter (where a.answered_at > now() - interval '14 days' and a.is_correct))::int as c14
    from ranked r
    left join public.path_unit_topics put on put.unit_id = r.id
    left join public.questions q on q.topic_id = put.topic_id
    left join public.practice_answers a on a.question_id = q.id and a.user_id = p_user and a.is_correct is not null
    group by r.id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'slug', r.slug,
      'name', r.name,
      'theme', r.theme,
      'themeOrder', r.theme_order,
      'questionCount', r.question_count,
      'askedRank', r.asked_rank,
      'syllabusRank', r.syllabus_rank,
      'stars', coalesce(ps.stars, 0),
      'answers', ev.answers,
      'days', ev.days,
      'revisit', coalesce(ps.stars, 0) >= 1 and ev.n14 >= 8 and ev.c14 * 10 < ev.n14 * 6
    )
    order by r.asked_rank
  ), '[]'::jsonb)
  from ranked r
  join ev on ev.unit_id = r.id
  left join public.path_stars ps on ps.unit_id = r.id and ps.user_id = p_user;
$$;

-- For Home: a line per subject, with the next unit and the whole trail in the student's order.
create or replace function public.get_path_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_mode text;
  v_order text := 'asked';
  v_out jsonb := '[]'::jsonb;
  v_units jsonb;
  r record;
begin
  select pp.mode, pp.order_by into v_mode, v_order from public.path_prefs pp where pp.user_id = v_user;
  v_order := coalesce(v_order, 'asked');

  for r in select distinct pu.subject_id from public.path_units pu where pu.active order by 1 loop
    v_units := private.path_subject(v_user, r.subject_id);
    if jsonb_array_length(v_units) = 0 then
      continue;
    end if;
    v_out := v_out || (
      select jsonb_build_object(
        'subjectId', r.subject_id,
        'unitCount', count(*),
        'started', count(*) filter (where (e ->> 'answers')::int > 0),
        'stars', coalesce(sum((e ->> 'stars')::int), 0),
        'maxStars', count(*) * 3,
        'next', (
          select jsonb_build_object('id', x ->> 'id', 'name', x ->> 'name',
            'index', case when v_order = 'syllabus' then (x ->> 'syllabusRank')::int else (x ->> 'askedRank')::int end)
          from jsonb_array_elements(v_units) x
          where (x ->> 'stars')::int < 3
          order by case when (x ->> 'stars')::int = 0 then 0 else 1 end,
                   case when v_order = 'syllabus' then (x ->> 'syllabusRank')::int else (x ->> 'askedRank')::int end
          limit 1
        ),
        'trail', (
          select jsonb_agg(
            jsonb_build_object('stars', (x ->> 'stars')::int, 'revisit', (x ->> 'revisit')::boolean)
            order by case when v_order = 'syllabus' then (x ->> 'syllabusRank')::int else (x ->> 'askedRank')::int end
          )
          from jsonb_array_elements(v_units) x
        )
      )
      from jsonb_array_elements(v_units) e
    );
  end loop;

  return jsonb_build_object('mode', v_mode, 'order', v_order, 'subjects', v_out);
end;
$$;
