-- The Lekki Headmaster, JAMB's prescribed novel. Its questions are Use of English questions about the
-- set text, so they live under English and point at the book. See docs/question-import-plan.md.

insert into public.prescribed_works (title, author)
select 'The Lekki Headmaster', 'Kabir Alabi Garba'
where not exists (
  select 1 from public.prescribed_works where title = 'The Lekki Headmaster' and author = 'Kabir Alabi Garba'
);

insert into public.work_assignments (work_id, paper, from_year)
select id, 'use_of_english', 2024 from public.prescribed_works
where title = 'The Lekki Headmaster' and author = 'Kabir Alabi Garba'
on conflict (work_id, paper, from_year) do nothing;

-- Publishing now also records the book a question is about (p_rows[].work_id, optional).
create or replace function public.import_publish(p_paper uuid, p_batch_no int, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper_key text;
  v_batch uuid;
  r jsonb;
  v_id uuid;
  v_inserted int := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  select paper_key into v_paper_key from public.import_papers where id = p_paper;
  if v_paper_key is null then
    raise exception 'unknown_paper';
  end if;

  insert into public.question_import_batches (source, file_name, summary)
  values ('myquest', v_paper_key, jsonb_build_object('paper_id', p_paper, 'batch_no', p_batch_no))
  returning id into v_batch;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_id := null;

    if exists (
      select 1 from public.question_import_rows
      where paper_id = p_paper and source_ref = r ->> 'source_ref' and status = 'imported'
    ) then
      v_skipped := v_skipped || jsonb_build_object('source_ref', r ->> 'source_ref', 'reason', 'already_published');
      continue;
    end if;

    insert into public.questions (subject_id, work_id, topic_id, subtopic_id, stem, options, year, source, source_ref, status)
    values (
      r ->> 'subject_id',
      nullif(r ->> 'work_id', '')::uuid,
      nullif(r ->> 'topic_id', '')::uuid,
      nullif(r ->> 'subtopic_id', '')::uuid,
      r -> 'stem',
      r -> 'options',
      nullif(r ->> 'year', '')::int,
      'past_paper',
      r ->> 'source_ref',
      'published'
    )
    on conflict do nothing
    returning id into v_id;

    if v_id is null then
      v_skipped := v_skipped || jsonb_build_object('source_ref', r ->> 'source_ref', 'reason', 'already_in_bank');
      continue;
    end if;

    insert into public.question_solutions (question_id, correct_option, hint, solution)
    values (v_id, r ->> 'correct_option', nullif(r -> 'hint', 'null'::jsonb), r -> 'solution');

    insert into public.question_import_rows (batch_id, source_ref, raw, normalised, status, question_id, paper_id, page, reasons)
    values (
      v_batch,
      r ->> 'source_ref',
      coalesce(r -> 'raw', '{}'::jsonb),
      r -> 'normalised',
      'imported',
      v_id,
      p_paper,
      nullif(r ->> 'page', '')::int,
      coalesce(array(select jsonb_array_elements_text(r -> 'notes')), '{}')
    );
    v_inserted := v_inserted + 1;
  end loop;

  update public.question_import_batches
  set summary = summary || jsonb_build_object('inserted', v_inserted, 'skipped', jsonb_array_length(v_skipped))
  where id = v_batch;

  return jsonb_build_object('batch_id', v_batch, 'inserted', v_inserted, 'skipped', v_skipped);
end;
$$;


revoke execute on function public.import_publish(uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.import_publish(uuid, int, jsonb) to service_role;
