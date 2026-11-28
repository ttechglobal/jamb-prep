-- Path units for English. The bank is small (about 264 questions) and tagged to only three topics, so the path
-- starts with one unit per topic. Regroup or split later as questions are added and tagged to subtopics.
--   Comprehension and Summary: ~93 questions
--   Lexis and Structure:       ~171 questions
--   Oral Forms:                 ~3 questions. Stays off the trail until it holds 5 published questions.
-- Units and counts track the bank live; a new English topic gets a unit of its own (see 20261128000004).

with u(slug, name, sort_order, theme, theme_order) as (values
  ('comprehension-and-summary', 'Comprehension and Summary', 10, 'Reading', 1),
  ('lexis-and-structure', 'Lexis and Structure', 20, 'Language', 2),
  ('oral-forms', 'Oral Forms', 30, 'Language', 2)
)
insert into public.path_units (subject_id, slug, name, sort_order, theme, theme_order)
select 'english', slug, name, sort_order, theme, theme_order from u;

with m(unit_slug, topic_slug) as (values
  ('comprehension-and-summary', 'comprehension-and-summary'),
  ('lexis-and-structure', 'lexis-and-structure'),
  ('oral-forms', 'oral-forms')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'english' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'english' and t.slug = m.topic_slug;
