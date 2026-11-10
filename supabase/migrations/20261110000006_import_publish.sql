-- Publishing and undoing a reviewed import batch. One call is one transaction: every question in
-- the call is written with its answer and explanation, or none of it is.
-- Service role only, like the other admin functions.

alter type public.import_row_status add value if not exists 'undone';

-- Only a live import row is unique per paper and source. An undone row is history, so the same
-- question can be published again after an undo.
drop index if exists public.question_import_rows_paper_source_idx;
create unique index question_import_rows_paper_source_idx
  on public.question_import_rows (paper_id, source_ref)
  where paper_id is not null and status = 'imported';

-- p_rows is a list of {source_ref, subject_id, topic_id, subtopic_id, year, stem, options,
-- correct_option, hint, solution, raw, normalised, notes}. Questions whose content already
-- exists in the bank are skipped and reported, never duplicated and never an error.
create function public.import_publish(p_paper uuid, p_batch_no int, p_rows jsonb)
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

    insert into public.questions (subject_id, topic_id, subtopic_id, stem, options, year, source, source_ref, status)
    values (
      r ->> 'subject_id',
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

-- Takes a published batch back. A question nobody has answered is deleted outright, so the same
-- paper can be imported again. A question that already appears in someone's practice is retired
-- instead, so their history keeps working.
create function public.import_undo(p_batch uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_deleted int := 0;
  v_retired int := 0;
begin
  for r in
    select id, question_id from public.question_import_rows where batch_id = p_batch and status = 'imported'
  loop
    begin
      delete from public.questions where id = r.question_id;
      v_deleted := v_deleted + 1;
    exception when foreign_key_violation then
      update public.questions set status = 'retired' where id = r.question_id;
      v_retired := v_retired + 1;
    end;
  end loop;

  update public.question_import_rows set status = 'undone' where batch_id = p_batch and status = 'imported';
  update public.question_import_batches
  set summary = summary || jsonb_build_object('undone', true, 'deleted', v_deleted, 'retired', v_retired)
  where id = p_batch;

  return jsonb_build_object('deleted', v_deleted, 'retired', v_retired);
end;
$$;

revoke execute on function public.import_publish(uuid, int, jsonb), public.import_undo(uuid) from public, anon, authenticated;
grant execute on function public.import_publish(uuid, int, jsonb), public.import_undo(uuid) to service_role;
