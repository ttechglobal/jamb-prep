-- XP for finishing a note in Read. A student gets it once per lesson, so reading the same note again earns nothing.
-- The award only runs from the app's server, which first checks that the lesson really exists in EXL Learn, so a
-- student cannot make up lesson ids to farm XP. Students can read their own completions (for the ticks in Read).

create table public.read_completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null,
  completed_at timestamptz not null default now(),
  xp int not null check (xp >= 0),
  primary key (user_id, lesson_id)
);

alter table public.read_completions enable row level security;
create policy read_completions_own on public.read_completions for select to authenticated using (user_id = (select auth.uid()));

create function public.award_read(p_user uuid, p_lesson uuid, p_xp int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int;
  v_xp int;
begin
  if p_xp < 0 or p_xp > 100 then
    raise exception 'invalid_xp' using errcode = 'P0001';
  end if;
  insert into public.read_completions (user_id, lesson_id, xp) values (p_user, p_lesson, p_xp)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select pp.xp into v_xp from public.player_progress pp where pp.user_id = p_user;
    return jsonb_build_object('awarded', 0, 'xp', coalesce(v_xp, 0));
  end if;
  update public.player_progress set xp = xp + p_xp where user_id = p_user returning xp into v_xp;
  if p_xp > 0 then
    insert into public.xp_log (user_id, xp) values (p_user, p_xp);
  end if;
  return jsonb_build_object('awarded', p_xp, 'xp', coalesce(v_xp, 0));
end;
$$;

revoke all on function public.award_read(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.award_read(uuid, uuid, int) to service_role;
