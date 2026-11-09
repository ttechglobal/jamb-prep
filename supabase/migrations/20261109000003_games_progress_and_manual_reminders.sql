-- 1. Game progress saved to the student's account, so it follows them across devices.
-- 2. A pause switch for automatic reminders.
-- 3. The admin page can pick a single student for a manual notification, and see how recent runs compare.

create table public.game_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('concord')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.game_progress enable row level security;
-- No policies and no grants: students reach this only through the two functions below.

create function public.get_game_progress(p_game text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  return coalesce((select data from public.game_progress where user_id = v_user and game = p_game), '{}'::jsonb);
end;
$$;

create function public.save_game_progress(p_game text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  if private.is_guest() then
    raise exception 'account_required' using errcode = 'P0001';
  end if;
  if p_game <> 'concord' or p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 2000 then
    raise exception 'invalid_progress' using errcode = 'P0001';
  end if;
  insert into public.game_progress (user_id, game, data, updated_at)
  values (v_user, p_game, p_data, now())
  on conflict (user_id, game) do update set data = excluded.data, updated_at = now();
end;
$$;

grant execute on function public.get_game_progress(text), public.save_game_progress(text, jsonb) to authenticated;

-- Automatic reminders can be paused from the admin page.
alter table public.app_settings add column reminders_enabled boolean not null default true;

-- The audience now also carries the student id and full name, for picking one student.
drop function public.reminder_audience();
create function public.reminder_audience()
returns table (
  sub_id uuid, user_id uuid, endpoint text, p256dh text, auth text,
  full_name text, first_name text, target int, streak int, practised_today boolean
)
language sql
security definer
set search_path = ''
as $$
  with today as (select (now() at time zone 'Africa/Lagos')::date as d)
  select
    s.id, s.user_id, s.endpoint, s.p256dh, s.auth,
    coalesce(nullif(trim(pr.display_name), ''), 'Student'),
    coalesce(nullif(split_part(trim(pr.display_name), ' ', 1), ''), 'Hi'),
    (select sum(ss.target_score)::int from public.student_subjects ss where ss.user_id = s.user_id),
    case when pp.last_practice_day >= (select d from today) - 1 then pp.current_streak else 0 end,
    coalesce(pp.last_practice_day = (select d from today), false)
  from public.push_subscriptions s
  left join public.profiles pr on pr.id = s.user_id
  left join public.player_progress pp on pp.user_id = s.user_id;
$$;
grant execute on function public.reminder_audience() to service_role;
grant select, update on public.app_settings to service_role;

-- The same numbers as the dashboard's headline cards, for the period just before, to show change.
create function public.admin_overview_prev(p_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 14), 1), 90);
  v_end timestamptz := ((now() at time zone 'Africa/Lagos')::date - (v_days - 1))::timestamp at time zone 'Africa/Lagos';
  v_start timestamptz := ((now() at time zone 'Africa/Lagos')::date - (2 * v_days - 1))::timestamp at time zone 'Africa/Lagos';
begin
  return jsonb_build_object(
    'joined', (select count(*) from public.profiles where onboarded_at >= v_start and onboarded_at < v_end),
    'rounds', (select count(*) from public.practice_sessions where started_at >= v_start and started_at < v_end),
    'finished', (select count(*) from public.practice_sessions where started_at >= v_start and started_at < v_end and status = 'submitted'),
    'active_members', (select count(distinct s.user_id) from public.practice_sessions s join auth.users u on u.id = s.user_id
                        where not u.is_anonymous and s.started_at >= v_start and s.started_at < v_end)
  );
end;
$$;
grant execute on function public.admin_overview_prev(int) to service_role;
