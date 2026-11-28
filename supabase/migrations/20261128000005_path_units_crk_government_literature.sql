-- Path units for CRK, Government and Literature, with themes, grouped so units hold enough questions for
-- rounds on different days (counts are distinct published questions as of writing).
--   CRK:        46 topics in 11 units (26 to 71 questions)
--   Government: 33 topics in 12 units (22 to 65)
--   Literature:  3 topics in  2 units (15 and 120; grows as prose and poetry questions are added)
-- Units and topics already track the bank live: more questions raise the counts, and a new topic in any of
-- these subjects gets a unit of its own (see 20261128000004).

-- CRK ----------------------------------------------------------------------------

with u(slug, name, sort_order, theme, theme_order) as (values
  ('god-covenant-providence', 'God, the covenant and providence', 10, 'Old Testament: God and his people', 1),
  ('leadership-obedience-david', 'Leadership, obedience and David', 30, 'Old Testament: God and his people', 1),
  ('supremacy-reforms-judah', 'The supremacy of God and the reforms of Judah', 100, 'Old Testament: the prophets', 2),
  ('prophets-justice-hope', 'Nineveh, social justice and hope', 140, 'Old Testament: the prophets', 2),
  ('jesus-birth-discipleship', 'Birth, baptism, discipleship and the Sermon on the Mount', 180, 'The life of Jesus', 3),
  ('miracles-parables', 'Miracles and parables of Jesus', 210, 'The life of Jesus', 3),
  ('last-days-of-jesus', 'The last days of Jesus', 270, 'The life of Jesus', 3),
  ('jesus-teachings-love-humility', 'Jesus'' teachings, love and humility', 310, 'The life of Jesus', 3),
  ('early-church-mission', 'The early church and its mission', 330, 'The early church and the epistles', 4),
  ('faith-law-grace', 'Faith, law and grace', 370, 'The early church and the epistles', 4),
  ('christian-living', 'Christian living and the Second Coming', 420, 'The early church and the epistles', 4)
)
insert into public.path_units (subject_id, slug, name, sort_order, theme, theme_order)
select 'crk', slug, name, sort_order, theme, theme_order from u;

with m(unit_slug, topic_slug) as (values
  ('god-covenant-providence', 'the-sovereignty-of-god'),
  ('god-covenant-providence', 'the-covenant'),
  ('god-covenant-providence', 'divine-providence-guidance-and-protection'),
  ('leadership-obedience-david', 'leadership-qualities'),
  ('leadership-obedience-david', 'obedience-and-disobedience'),
  ('leadership-obedience-david', 'a-man-after-god-s-own-heart-david'),
  ('leadership-obedience-david', 'parental-responsibility'),
  ('leadership-obedience-david', 'decision-making'),
  ('leadership-obedience-david', 'greed-and-its-effects'),
  ('supremacy-reforms-judah', 'the-supremacy-of-god'),
  ('supremacy-reforms-judah', 'religious-reforms-in-judah'),
  ('supremacy-reforms-judah', 'concern-for-judah'),
  ('supremacy-reforms-judah', 'faith-courage-and-protection'),
  ('prophets-justice-hope', 'god-s-message-to-nineveh'),
  ('prophets-justice-hope', 'social-justice-true-religion-and-divine-love'),
  ('prophets-justice-hope', 'holiness-and-divine-call'),
  ('prophets-justice-hope', 'punishment-and-hope'),
  ('jesus-birth-discipleship', 'the-birth-and-early-life-of-jesus'),
  ('jesus-birth-discipleship', 'the-baptism-and-temptation-of-jesus'),
  ('jesus-birth-discipleship', 'discipleship'),
  ('jesus-birth-discipleship', 'mission-of-the-disciples'),
  ('jesus-birth-discipleship', 'the-great-confession'),
  ('jesus-birth-discipleship', 'the-sermon-on-the-mount'),
  ('miracles-parables', 'miracles-of-jesus'),
  ('miracles-parables', 'the-parables-of-jesus'),
  ('last-days-of-jesus', 'the-triumphal-entry-and-the-cleansing-of-the-temple'),
  ('last-days-of-jesus', 'the-last-supper'),
  ('last-days-of-jesus', 'the-trials-and-death-of-jesus'),
  ('last-days-of-jesus', 'resurrection-appearances-and-ascension-of-jesus'),
  ('jesus-teachings-love-humility', 'jesus-teachings-about-himself'),
  ('jesus-teachings-love-humility', 'love'),
  ('jesus-teachings-love-humility', 'humility'),
  ('early-church-mission', 'fellowship-in-the-early-church'),
  ('early-church-mission', 'the-holy-spirit-and-the-mission-of-the-church'),
  ('early-church-mission', 'opposition-to-the-gospel-message'),
  ('early-church-mission', 'mission-to-the-gentiles'),
  ('faith-law-grace', 'justification-by-faith'),
  ('faith-law-grace', 'the-law-and-grace'),
  ('faith-law-grace', 'new-life-in-christ'),
  ('faith-law-grace', 'christians-as-joint-heirs-with-christ'),
  ('christian-living', 'forgiveness'),
  ('christian-living', 'spiritual-gifts'),
  ('christian-living', 'christian-giving'),
  ('christian-living', 'effective-prayer'),
  ('christian-living', 'christian-living-in-the-community'),
  ('christian-living', 'the-second-coming-of-christ')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'crk' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'crk' and t.slug = m.topic_slug;

-- Government -----------------------------------------------------------------------

with u(slug, name, sort_order, theme, theme_order) as (values
  ('concepts-forms-systems', 'Concepts, forms and systems of government', 10, 'Principles of government', 1),
  ('arms-and-legislation', 'Arms of government and legislation', 40, 'Principles of government', 1),
  ('ideologies-constitution-democracy', 'Ideologies, constitutions and democracy', 70, 'Principles of government', 1),
  ('citizenship-elections', 'Citizenship and the electoral process', 110, 'Citizens, elections and parties', 2),
  ('parties-groups-civil-service', 'Parties, pressure groups and the civil service', 130, 'Citizens, elections and parties', 2),
  ('early-nigeria-colonial-rule', 'Early Nigeria and colonial rule', 170, 'Nigeria: from the past to independence', 3),
  ('constitutional-development', 'Constitutional development in Nigeria', 200, 'Nigeria: from the past to independence', 3),
  ('institutions-commissions-parties', 'Nigerian institutions, commissions and parties', 220, 'Governing Nigeria', 4),
  ('federalism-local-government', 'Federalism and local government', 250, 'Governing Nigeria', 4),
  ('military-in-politics', 'The military in Nigerian politics', 280, 'Governing Nigeria', 4),
  ('foreign-policy', 'Foreign policy and relations with Africa', 290, 'Foreign policy and the world', 5),
  ('international-organizations', 'International organizations', 320, 'Foreign policy and the world', 5)
)
insert into public.path_units (subject_id, slug, name, sort_order, theme, theme_order)
select 'government', slug, name, sort_order, theme, theme_order from u;

with m(unit_slug, topic_slug) as (values
  ('concepts-forms-systems', 'definition-and-scope-of-government'),
  ('concepts-forms-systems', 'basic-concepts-of-government'),
  ('concepts-forms-systems', 'forms-of-government'),
  ('concepts-forms-systems', 'structures-of-governance'),
  ('concepts-forms-systems', 'systems-of-governance'),
  ('arms-and-legislation', 'arms-of-government'),
  ('arms-and-legislation', 'processes-of-legislation'),
  ('ideologies-constitution-democracy', 'political-ideologies'),
  ('ideologies-constitution-democracy', 'constitution'),
  ('ideologies-constitution-democracy', 'principles-of-democratic-government'),
  ('citizenship-elections', 'citizenship'),
  ('citizenship-elections', 'the-electoral-process'),
  ('parties-groups-civil-service', 'political-parties-and-party-systems'),
  ('parties-groups-civil-service', 'pressure-groups'),
  ('parties-groups-civil-service', 'public-opinion'),
  ('parties-groups-civil-service', 'the-civil-service-and-public-service'),
  ('early-nigeria-colonial-rule', 'pre-colonial-polities'),
  ('early-nigeria-colonial-rule', 'imperialist-penetration'),
  ('early-nigeria-colonial-rule', 'process-of-decolonization'),
  ('constitutional-development', 'constitutional-development-in-nigeria'),
  ('constitutional-development', 'post-independence-constitutions'),
  ('institutions-commissions-parties', 'institutions-of-government-in-post-independence-nigeria'),
  ('institutions-commissions-parties', 'public-commissions-established-by-the-1979-and-subsequent-constitutions'),
  ('institutions-commissions-parties', 'political-parties-and-party-politics-in-post-independence-nigeria'),
  ('institutions-commissions-parties', 'public-corporations-and-parastatals'),
  ('federalism-local-government', 'structure-and-workings-of-nigerian-federalism'),
  ('federalism-local-government', 'local-government'),
  ('military-in-politics', 'the-military-in-nigerian-politics'),
  ('foreign-policy', 'foreign-policy'),
  ('foreign-policy', 'nigeria-s-foreign-policy'),
  ('foreign-policy', 'nigeria-s-relations-with-african-countries'),
  ('international-organizations', 'nigeria-in-international-organizations'),
  ('international-organizations', 'international-organizations')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'government' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'government' and t.slug = m.topic_slug;

-- Literature in English ---------------------------------------------------------------

with u(slug, name, sort_order, theme, theme_order) as (values
  ('drama', 'Drama', 10, 'Drama', 1),
  ('prose-and-poetry', 'Prose and poetry', 20, 'Prose and poetry', 2)
)
insert into public.path_units (subject_id, slug, name, sort_order, theme, theme_order)
select 'literature', slug, name, sort_order, theme, theme_order from u;

with m(unit_slug, topic_slug) as (values
  ('drama', 'drama'),
  ('prose-and-poetry', 'prose'),
  ('prose-and-poetry', 'poetry')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'literature' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'literature' and t.slug = m.topic_slug;

do $$
declare
  r record;
begin
  for r in
    select s.subject_id, s.expected, (
      select count(*) from public.path_unit_topics put join public.path_units pu on pu.id = put.unit_id where pu.subject_id = s.subject_id
    ) as found
    from (values ('crk', 46), ('government', 33), ('literature', 3)) as s(subject_id, expected)
  loop
    if r.found <> r.expected then
      raise exception '% units must cover all % topics, found %', r.subject_id, r.expected, r.found;
    end if;
  end loop;
end;
$$;
