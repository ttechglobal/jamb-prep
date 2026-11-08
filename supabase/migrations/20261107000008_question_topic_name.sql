-- Questions show their topic while practising. Sent with the question so the app doesn't
-- download the whole topic list for it.
create or replace function private.public_question(q public.questions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', q.id,
    'subjectId', q.subject_id,
    'topicId', q.topic_id,
    'topicName', (select t.name from public.topics t where t.id = q.topic_id),
    'instruction', q.instruction,
    'context', (
      select jsonb_build_object('id', c.id, 'kind', c.kind, 'title', c.title, 'blocks', c.blocks, 'credit', c.credit)
      from public.shared_contexts c
      where c.id = q.context_id
    ),
    'work', (
      select jsonb_build_object('title', w.title, 'author', w.author, 'reference', q.work_reference)
      from public.prescribed_works w
      where w.id = q.work_id
    ),
    'stem', q.stem,
    'options', q.options
  );
$$;

revoke all on function private.public_question(public.questions) from public, anon, authenticated;
