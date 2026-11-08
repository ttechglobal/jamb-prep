-- Starting subjects, matching the app's current catalogue. The list will be reconciled with
-- the real question bank during import.
insert into public.subjects (id, name, short_name, is_compulsory, sort_order) values
  ('english', 'Use of English', 'English', true, 0),
  ('mathematics', 'Mathematics', 'Maths', false, 10),
  ('physics', 'Physics', 'Physics', false, 20),
  ('chemistry', 'Chemistry', 'Chemistry', false, 30),
  ('biology', 'Biology', 'Biology', false, 40),
  ('economics', 'Economics', 'Economics', false, 50),
  ('government', 'Government', 'Govt', false, 60),
  ('literature', 'Literature in English', 'Literature', false, 70),
  ('commerce', 'Commerce', 'Commerce', false, 80),
  ('geography', 'Geography', 'Geography', false, 90);

-- Verified 7 Nov 2026 against JAMB's 2026 UTME Manual for Officials.
-- Re-verify against official JAMB guidance before each release season.
insert into public.exam_formats (name, total_duration_sec, compulsory_subject_id, rules, effective_from, active)
values (
  'UTME 2026',
  7200,
  'english',
  jsonb_build_object(
    'subject_count', 4,
    'compulsory_question_count', 60,
    'other_question_count', 40,
    'max_per_subject', 100,
    'max_total', 400
  ),
  '2026-01-01',
  true
);
