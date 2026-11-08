-- Start from nothing, then grant only what each role needs.
-- Supabase's default privileges would otherwise give anon and authenticated full table access.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Policy check only: students get an empty result from these tables, never answer data.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_valid_question_options(jsonb) to anon, authenticated;

-- Reference data is public; only admins change it.
grant select on public.subjects, public.topics, public.exam_formats to anon, authenticated;
grant insert, update, delete on public.subjects, public.topics, public.exam_formats to authenticated;

create policy subjects_read on public.subjects for select to anon, authenticated using (true);
create policy subjects_admin_insert on public.subjects for insert to authenticated with check (public.is_admin());
create policy subjects_admin_update on public.subjects for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy subjects_admin_delete on public.subjects for delete to authenticated using (public.is_admin());

create policy topics_read on public.topics for select to anon, authenticated using (true);
create policy topics_admin_insert on public.topics for insert to authenticated with check (public.is_admin());
create policy topics_admin_update on public.topics for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy topics_admin_delete on public.topics for delete to authenticated using (public.is_admin());

create policy exam_formats_read on public.exam_formats for select to anon, authenticated using (true);
create policy exam_formats_admin_insert on public.exam_formats for insert to authenticated with check (public.is_admin());
create policy exam_formats_admin_update on public.exam_formats for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy exam_formats_admin_delete on public.exam_formats for delete to authenticated using (public.is_admin());

-- Questions: admins only. Students receive questions solely through the session functions.
grant select, insert, update, delete on public.questions to authenticated;
create policy questions_admin on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Own data, read-only. All writes go through the functions, so a student can't edit XP or role.
grant select on public.profiles, public.student_goals, public.student_subjects,
  public.player_progress, public.practice_sessions, public.practice_answers to authenticated;

create policy profiles_own_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy student_goals_own_read on public.student_goals for select to authenticated
  using (user_id = auth.uid());
create policy student_subjects_own_read on public.student_subjects for select to authenticated
  using (user_id = auth.uid());
create policy player_progress_own_read on public.player_progress for select to authenticated
  using (user_id = auth.uid());
create policy practice_sessions_own_read on public.practice_sessions for select to authenticated
  using (user_id = auth.uid());
create policy practice_answers_own_read on public.practice_answers for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.practice_sessions s
      where s.id = session_id and s.status <> 'in_progress'
    )
  );

-- practice_session_questions: no grants. It is only reachable through the session functions.

grant select, insert on public.question_reports to authenticated;
grant update, delete on public.question_reports to authenticated;
create policy question_reports_own_insert on public.question_reports for insert to authenticated
  with check (user_id = auth.uid());
create policy question_reports_own_read on public.question_reports for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy question_reports_admin_update on public.question_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy question_reports_admin_delete on public.question_reports for delete to authenticated
  using (public.is_admin());

grant select, insert on public.admin_audit_log to authenticated;
create policy admin_audit_log_read on public.admin_audit_log for select to authenticated
  using (public.is_admin());
create policy admin_audit_log_insert on public.admin_audit_log for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

grant select, insert, update, delete on public.question_import_batches, public.question_import_rows to authenticated;
create policy question_import_batches_admin on public.question_import_batches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy question_import_rows_admin on public.question_import_rows for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- The client API.
grant execute on function public.count_questions(text, uuid) to anon, authenticated;
grant execute on function public.complete_onboarding(text, text[], int) to authenticated;
grant execute on function public.start_session(jsonb) to authenticated;
grant execute on function public.get_session(uuid) to authenticated;
grant execute on function public.save_answer(uuid, uuid, text) to authenticated;
grant execute on function public.submit_session(uuid) to authenticated;
grant execute on function public.get_results(uuid) to authenticated;
