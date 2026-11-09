-- First-party analytics, the owner's admin password, and reminder content/logging.
-- Reminder sending moves from Vercel Cron to a Supabase Edge Function (see supabase/functions/send-reminders).
-- Nothing here is readable by students: tables have no policies and no grants, and the admin functions are
-- callable only with the server's secret key (service_role).

-- ---------------------------------------------------------------------------------------------
-- Events: a small set of named moments (landing seen, round finished, game played ...).
-- visitor_id is a random id kept in the browser, so a visitor can be followed from the landing
-- page to sign-up without knowing who they are. No names, emails or answers are stored.
-- ---------------------------------------------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  visitor_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb
);
create index events_name_at_idx on public.events (name, at);
create index events_visitor_idx on public.events (visitor_id);
alter table public.events enable row level security;

create function public.track_event(p_visitor text, p_name text, p_props jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_name not in (
    'landing_view', 'start_click', 'round_started', 'round_completed', 'free_limit_reached',
    'register_view', 'register_submitted', 'onboarding_done',
    'game_started', 'game_completed', 'install_accepted', 'reminders_enabled'
  ) then
    return;
  end if;
  if length(coalesce(p_visitor, '')) not between 8 and 64 then
    return;
  end if;
  insert into public.events (visitor_id, user_id, name, props)
  values (
    p_visitor,
    auth.uid(),
    p_name,
    case when p_props is not null and jsonb_typeof(p_props) = 'object' and length(p_props::text) <= 500 then p_props else '{}'::jsonb end
  );
end;
$$;
grant execute on function public.track_event(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Owner settings: one row. The admin password is stored only as a bcrypt hash.
-- ---------------------------------------------------------------------------------------------
create table public.app_settings (
  id int primary key check (id = 1),
  admin_password_hash text,
  exam_date date
);
insert into public.app_settings (id) values (1);
alter table public.app_settings enable row level security;

create table public.admin_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);
alter table public.admin_attempts enable row level security;

create function public.admin_verify_password(p_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_ok boolean;
begin
  delete from public.admin_attempts where at < now() - interval '1 day';
  if (select count(*) from public.admin_attempts where at > now() - interval '15 minutes') >= 5 then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  select admin_password_hash into v_hash from public.app_settings where id = 1;
  v_ok := v_hash is not null and v_hash = extensions.crypt(coalesce(p_password, ''), v_hash);
  if v_ok then
    delete from public.admin_attempts where true;
  else
    insert into public.admin_attempts default values;
  end if;
  return v_ok;
end;
$$;

create function public.admin_set_password(p_new text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(coalesce(p_new, '')) < 8 then
    raise exception 'weak_password' using errcode = 'P0001';
  end if;
  update public.app_settings set admin_password_hash = extensions.crypt(p_new, extensions.gen_salt('bf')) where id = 1;
end;
$$;

-- Signs the admin cookie. Changing the password changes this value, which signs everyone out.
create function public.admin_password_hash()
returns text
language sql
security definer
set search_path = ''
as $$ select admin_password_hash from public.app_settings where id = 1 $$;

-- ---------------------------------------------------------------------------------------------
-- Reminder content (edited from the admin page) and a log of what each run did.
-- Placeholders in text: {name} {target} {streak} {days}
-- ---------------------------------------------------------------------------------------------
create table public.reminder_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('morning_goal', 'morning_plain', 'morning_countdown', 'evening_streak', 'evening_nudge')),
  title text not null check (length(trim(title)) between 1 and 60),
  body text not null check (length(trim(body)) between 1 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.reminder_templates enable row level security;

create table public.reminder_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  slot text not null,
  devices int not null default 0,
  sent int not null default 0,
  skipped int not null default 0,
  removed int not null default 0,
  failed int not null default 0
);
alter table public.reminder_log enable row level security;

insert into public.reminder_templates (kind, title, body) values
  ('morning_goal', 'Your goal: {target} in JAMB', '{name}, you can get there by practising. Start today with a Quick Five.'),
  ('morning_goal', 'Your goal: {target} in JAMB', 'Every question you practise moves you toward {target}. Test yourself today.'),
  ('morning_goal', 'Good morning, {name}', 'Your desired JAMB score is {target}. Ready for today''s round?'),
  ('morning_plain', 'Good morning! Ready to practise?', '{name}, start your day with five questions.'),
  ('morning_countdown', 'JAMB is {days} days away', '{name}, your desired score is {target}. Practise today to get closer.'),
  ('evening_streak', 'Your {streak}-day streak is at risk', '{name}, one Quick Five before bed keeps it alive.'),
  ('evening_nudge', 'Have you practised today?', '{name}, five questions takes about two minutes. Test yourself now.'),
  ('evening_nudge', 'Have you practised today?', 'A little practice every day beats a long cram. Do today''s Quick Five.'),
  ('evening_nudge', 'Today isn''t over yet', '{name}, one round is all it takes.');

-- Everyone a reminder could go to, with what the message needs. Lagos time throughout.
create function public.reminder_audience()
returns table (
  sub_id uuid, endpoint text, p256dh text, auth text,
  first_name text, target int, streak int, practised_today boolean
)
language sql
security definer
set search_path = ''
as $$
  with today as (select (now() at time zone 'Africa/Lagos')::date as d)
  select
    s.id, s.endpoint, s.p256dh, s.auth,
    coalesce(nullif(split_part(trim(pr.display_name), ' ', 1), ''), 'Hi'),
    (select sum(ss.target_score)::int from public.student_subjects ss where ss.user_id = s.user_id),
    case when pp.last_practice_day >= (select d from today) - 1 then pp.current_streak else 0 end,
    coalesce(pp.last_practice_day = (select d from today), false)
  from public.push_subscriptions s
  left join public.profiles pr on pr.id = s.user_id
  left join public.player_progress pp on pp.user_id = s.user_id;
$$;

-- ---------------------------------------------------------------------------------------------
-- The admin dashboard's numbers, in one call. Days are Lagos days.
-- ---------------------------------------------------------------------------------------------
create function public.admin_overview(p_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 14), 1), 90);
  v_since timestamptz := ((now() at time zone 'Africa/Lagos')::date - (v_days - 1))::timestamp at time zone 'Africa/Lagos';
  v_funnel jsonb;
  v_daily jsonb;
  v_modes jsonb;
  v_users jsonb;
  v_games jsonb;
  v_app jsonb;
begin
  -- Funnel: distinct visitors who did each step in the period (not strictly in order).
  select jsonb_agg(jsonb_build_object('step', label, 'visitors', n) order by ord) into v_funnel
  from (
    select 1 ord, 'Saw the landing page' label, count(distinct visitor_id) n from public.events where at >= v_since and name = 'landing_view'
    union all select 2, 'Tapped Start practising', count(distinct visitor_id) from public.events where at >= v_since and name = 'start_click'
    union all select 3, 'Started a first round', count(distinct visitor_id) from public.events where at >= v_since and name = 'round_started'
    union all select 4, 'Finished a round', count(distinct visitor_id) from public.events where at >= v_since and name = 'round_completed'
    union all select 5, 'Opened Create account', count(distinct visitor_id) from public.events where at >= v_since and name = 'register_view'
    union all select 6, 'Submitted sign-up', count(distinct visitor_id) from public.events where at >= v_since and name = 'register_submitted'
    union all select 7, 'Finished setup', count(distinct visitor_id) from public.events where at >= v_since and name = 'onboarding_done'
    union all select 8, 'Practised as a member', count(distinct visitor_id) from public.events where at >= v_since and name = 'round_started' and props->>'guest' = 'false'
  ) f;

  select jsonb_agg(jsonb_build_object('day', day, 'rounds', rounds, 'active', active, 'joined', joined) order by day) into v_daily
  from (
    select g.day::date as day,
      coalesce((select count(*) from public.practice_sessions s where (s.started_at at time zone 'Africa/Lagos')::date = g.day::date), 0) as rounds,
      coalesce((select count(distinct s.user_id) from public.practice_sessions s where (s.started_at at time zone 'Africa/Lagos')::date = g.day::date), 0) as active,
      coalesce((select count(*) from public.profiles p where (p.onboarded_at at time zone 'Africa/Lagos')::date = g.day::date), 0) as joined
    from generate_series((v_since at time zone 'Africa/Lagos')::date, (now() at time zone 'Africa/Lagos')::date, interval '1 day') g(day)
  ) d;

  select coalesce(jsonb_agg(jsonb_build_object('mode', mode, 'started', started, 'completed', completed, 'students', students) order by started desc), '[]'::jsonb) into v_modes
  from (
    select s.mode::text as mode, count(*) as started, count(*) filter (where s.status = 'submitted') as completed, count(distinct s.user_id) as students
    from public.practice_sessions s where s.started_at >= v_since group by s.mode
  ) m;

  select jsonb_build_object(
    'members', (select count(*) from public.profiles where onboarded_at is not null),
    'joined', (select count(*) from public.profiles where onboarded_at >= v_since),
    'active_today', (select count(distinct s.user_id) from public.practice_sessions s join auth.users u on u.id = s.user_id
                      where not u.is_anonymous and (s.started_at at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date),
    'active_7d', (select count(distinct s.user_id) from public.practice_sessions s join auth.users u on u.id = s.user_id
                   where not u.is_anonymous and s.started_at >= now() - interval '7 days'),
    'practised_on_2plus_days', (select count(*) from (
        select s.user_id from public.practice_sessions s join auth.users u on u.id = s.user_id
        where not u.is_anonymous and s.started_at >= v_since
        group by s.user_id having count(distinct (s.started_at at time zone 'Africa/Lagos')::date) >= 2) r),
    'rounds_per_active_member', (select round(count(*)::numeric / nullif(count(distinct s.user_id), 0), 1)
                                  from public.practice_sessions s join auth.users u on u.id = s.user_id
                                  where not u.is_anonymous and s.started_at >= v_since),
    'guests_in_period', (select count(distinct s.user_id) from public.practice_sessions s join auth.users u on u.id = s.user_id
                          where u.is_anonymous and s.started_at >= v_since)
  ) into v_users;

  select coalesce(jsonb_agg(jsonb_build_object('game', game, 'started', started, 'completed', completed, 'players', players, 'avg_stars', avg_stars) order by started desc), '[]'::jsonb) into v_games
  from (
    select coalesce(props->>'game', 'unknown') as game,
      count(*) filter (where name = 'game_started') as started,
      count(*) filter (where name = 'game_completed') as completed,
      count(distinct visitor_id) as players,
      round(avg((props->>'stars')::numeric) filter (where name = 'game_completed'), 1) as avg_stars
    from public.events where at >= v_since and name in ('game_started', 'game_completed') group by 1
  ) g;

  select jsonb_build_object(
    'install_accepted', (select count(distinct visitor_id) from public.events where at >= v_since and name = 'install_accepted'),
    'reminders_enabled', (select count(distinct visitor_id) from public.events where at >= v_since and name = 'reminders_enabled'),
    'devices_subscribed', (select count(*) from public.push_subscriptions),
    'students_subscribed', (select count(distinct user_id) from public.push_subscriptions)
  ) into v_app;

  return jsonb_build_object('days', v_days, 'funnel', v_funnel, 'daily', v_daily, 'modes', v_modes, 'users', v_users, 'games', v_games, 'app', v_app);
end;
$$;

grant execute on function
  public.admin_verify_password(text), public.admin_set_password(text), public.admin_password_hash(),
  public.reminder_audience(), public.admin_overview(int)
to service_role;
grant select, insert, update, delete on public.reminder_templates to service_role;
grant select, insert on public.reminder_log to service_role;
grant select, update on public.app_settings to service_role;
