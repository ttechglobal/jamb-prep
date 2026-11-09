-- Offline apps (Windows school and student apps, Android student app).
-- Adds: schools and their devices, usage events from devices, campaigns, remote config,
-- the list of downloadable question packs, and the leaderboard.
-- Contracts and reasoning: docs/offline-app-contracts.md.
--
-- Security follows the rest of the project: tables have row level security and no policies or grants,
-- so nothing is readable directly. Devices and students reach data only through the functions below.
-- Public functions are granted one by one (default privileges already revoke them). Admin functions
-- are callable only with the server's secret key (service_role), like the existing admin functions.

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- A school is identified by its phone number. This keeps the last 10 digits, so +234 803 123 4567,
-- 234803..., and 0803 123 4567 all match. Returns null for anything with fewer than 10 digits.
create function private.phone_key(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when length(d) >= 10 then right(d, 10) end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x
$$;

-- Device-supplied numbers are untrusted: anything that is not a plain number becomes null.
create function private.safe_int(p_text text)
returns int
language sql
immutable
set search_path = ''
as $$ select case when p_text ~ '^\d{1,9}$' then p_text::int end $$;

-- "Ada Okafor" -> "Ada O." Only this ever leaves the database about a student.
create function private.leaderboard_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when array_length(w, 1) is null then 'Student'
    when array_length(w, 1) = 1 then initcap(w[1])
    else initcap(w[1]) || ' ' || upper(left(w[array_length(w, 1)], 1)) || '.'
  end
  from (select regexp_split_to_array(trim(coalesce(p_name, '')), '\s+') as w) x
$$;

-- ---------------------------------------------------------------------------------------------
-- Schools, devices, events
-- ---------------------------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 3 and 120),
  phone text not null,
  phone_key text not null unique,
  state text not null check (length(trim(state)) between 2 and 40),
  area text not null check (length(trim(area)) between 2 and 80),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.schools enable row level security;

-- One row per installed copy. The id is generated on the device and acts as its secret.
-- The label shown to people is prefix + zero padded number, for example GCI-001.
-- Prefix and number are not unique across schools, only within one school.
create table public.school_devices (
  id uuid primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  prefix text not null check (prefix ~ '^[A-Z0-9]{2,8}$'),
  number int not null check (number between 1 and 999),
  os text check (os is null or length(os) <= 40),
  app_version text check (app_version is null or length(app_version) <= 20),
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique (school_id, prefix, number)
);
create index school_devices_school_idx on public.school_devices (school_id);
alter table public.school_devices enable row level security;

-- Usage events uploaded in batches. The id is made on the device, so a retried upload cannot duplicate.
-- kinds and props (see docs/offline-app-contracts.md):
--   app_opened          {}
--   session_started     {total}
--   session_completed   {total, answered, correct, duration_sec, per_topic: [{topic_id, name, answered, correct}]}
--   session_abandoned   {total, answered}
--   pack_downloaded     {version}
--   pack_failed         {version, error}
--   game_completed      {game, level, stars}
create table public.school_events (
  id uuid primary key,
  device_id uuid not null references public.school_devices (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  at timestamptz not null,
  kind text not null check (kind in (
    'app_opened', 'session_started', 'session_completed', 'session_abandoned',
    'pack_downloaded', 'pack_failed', 'game_completed'
  )),
  subject_id text,
  mode text,
  props jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
create index school_events_school_at_idx on public.school_events (school_id, at);
create index school_events_kind_at_idx on public.school_events (kind, at);
alter table public.school_events enable row level security;

-- Autofill for the register screen: type the phone number, find the school.
create function public.lookup_school(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text := private.phone_key(p_phone);
  s public.schools;
begin
  if v_key is null then
    return jsonb_build_object('found', false);
  end if;
  select * into s from public.schools where phone_key = v_key;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object(
    'found', true,
    'name', s.name,
    'state', s.state,
    'area', s.area,
    'devices', (select count(*) from public.school_devices where school_id = s.id),
    -- The prefix most devices use, so the next PC starts from the same one.
    'prefix', (select prefix from public.school_devices where school_id = s.id group by prefix order by count(*) desc, prefix limit 1)
  );
end;
$$;

-- Smallest unused device number for a prefix within one school.
create function private.next_device_number(p_school uuid, p_prefix text)
returns int
language sql
stable
set search_path = ''
as $$
  select min(g) from generate_series(1, 999) g
  where not exists (
    select 1 from public.school_devices d where d.school_id = p_school and d.prefix = p_prefix and d.number = g
  )
$$;

-- Registers a device, creating the school if its phone number is new.
-- Online: a number that is already taken fails with 'device_number_taken' and the next free number in detail,
-- so the app can offer it. Offline registrations (p_offline) were made without a check, so the device is
-- renumbered instead of rejected, and the app is told the label it now has. Safe to call again with the same device id.
create function public.register_school_device(
  p_device_id uuid,
  p_name text,
  p_phone text,
  p_state text,
  p_area text,
  p_prefix text,
  p_number int,
  p_app_version text default null,
  p_os text default null,
  p_offline boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := private.phone_key(p_phone);
  v_prefix text := upper(regexp_replace(coalesce(p_prefix, ''), '[^A-Za-z0-9]', '', 'g'));
  v_number int := p_number;
  v_renumbered boolean := false;
  s public.schools;
  d public.school_devices;
begin
  if p_device_id is null then
    raise exception 'invalid_device' using errcode = 'P0001';
  end if;

  select * into d from public.school_devices where id = p_device_id;
  if found then
    update public.school_devices
    set last_seen_at = now(), app_version = coalesce(p_app_version, app_version)
    where id = d.id;
    select * into s from public.schools where id = d.school_id;
    return jsonb_build_object(
      'school_id', s.id, 'school_name', s.name, 'state', s.state, 'area', s.area,
      'prefix', d.prefix, 'number', d.number,
      'label', d.prefix || '-' || lpad(d.number::text, 3, '0'), 'renumbered', false
    );
  end if;

  if v_key is null
    or length(trim(coalesce(p_name, ''))) not between 3 and 120
    or length(trim(coalesce(p_state, ''))) not between 2 and 40
    or length(trim(coalesce(p_area, ''))) not between 2 and 80
    or length(v_prefix) not between 2 and 8
    or v_number is null or v_number not between 1 and 999
  then
    raise exception 'invalid_registration' using errcode = 'P0001';
  end if;

  insert into public.schools (name, phone, phone_key, state, area)
  values (trim(p_name), trim(p_phone), v_key, trim(p_state), trim(p_area))
  on conflict (phone_key) do nothing;
  select * into s from public.schools where phone_key = v_key;

  if exists (
    select 1 from public.school_devices where school_id = s.id and prefix = v_prefix and number = v_number
  ) then
    if not p_offline then
      raise exception 'device_number_taken' using errcode = 'P0001', detail = private.next_device_number(s.id, v_prefix)::text;
    end if;
    v_number := private.next_device_number(s.id, v_prefix);
    if v_number is null then
      raise exception 'no_free_number' using errcode = 'P0001';
    end if;
    v_renumbered := true;
  end if;

  begin
    insert into public.school_devices (id, school_id, prefix, number, os, app_version, last_seen_at)
    values (p_device_id, s.id, v_prefix, v_number, p_os, p_app_version, now());
  exception when unique_violation then
    -- Two devices raced for the same number.
    raise exception 'device_number_taken' using errcode = 'P0001', detail = private.next_device_number(s.id, v_prefix)::text;
  end;

  update public.schools set last_seen_at = now() where id = s.id;

  return jsonb_build_object(
    'school_id', s.id, 'school_name', s.name, 'state', s.state, 'area', s.area,
    'prefix', v_prefix, 'number', v_number,
    'label', v_prefix || '-' || lpad(v_number::text, 3, '0'), 'renumbered', v_renumbered
  );
end;
$$;

-- Batch upload. p_events is an array of {id, at, kind, subject, mode, props}. Up to 500 per call.
-- Unknown kinds and oversized props are dropped; repeated ids are ignored.
create function public.school_sync(p_device_id uuid, p_events jsonb, p_app_version text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school uuid;
  v_n int := 0;
begin
  select school_id into v_school from public.school_devices where id = p_device_id;
  if not found then
    raise exception 'unknown_device' using errcode = 'P0001';
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 500 then
    raise exception 'bad_batch' using errcode = 'P0001';
  end if;

  insert into public.school_events (id, device_id, school_id, at, kind, subject_id, mode, props)
  select
    (e ->> 'id')::uuid,
    p_device_id,
    v_school,
    -- A wrong clock must not put events in the future.
    least((e ->> 'at')::timestamptz, now()),
    e ->> 'kind',
    left(e ->> 'subject', 40),
    left(e ->> 'mode', 20),
    coalesce(e -> 'props', '{}'::jsonb)
  from jsonb_array_elements(p_events) e
  where e ->> 'kind' in (
      'app_opened', 'session_started', 'session_completed', 'session_abandoned',
      'pack_downloaded', 'pack_failed', 'game_completed'
    )
    and jsonb_typeof(coalesce(e -> 'props', '{}'::jsonb)) = 'object'
    and length(coalesce(e -> 'props', '{}'::jsonb)::text) <= 4000
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;

  update public.school_devices
  set last_seen_at = now(), app_version = coalesce(p_app_version, app_version)
  where id = p_device_id;
  update public.schools set last_seen_at = now() where id = v_school;

  return jsonb_build_object('accepted', v_n);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Campaigns and remote config (both edited from the admin page)
-- ---------------------------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  body text not null check (length(trim(body)) between 1 and 500),
  -- Optional "learn more" or sign-up link shown on the details sheet.
  link_url text check (link_url is null or length(link_url) <= 300),
  audience text not null default 'all' check (audience in ('all', 'school', 'student')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.campaigns enable row level security;

-- Only campaigns that are switched on and inside their dates, for one audience. Apps cache the result.
create function public.get_campaigns(p_audience text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'body', c.body, 'link_url', c.link_url,
    'starts_at', c.starts_at, 'ends_at', c.ends_at
  ) order by c.starts_at), '[]'::jsonb)
  from public.campaigns c
  where c.active
    and now() between c.starts_at and c.ends_at
    and c.audience in ('all', coalesce(p_audience, 'all'))
$$;

-- Settings the apps read without a new release. Empty values are not sent.
--   signup_link             where "how to sign up" points (the sheet's link and QR code)
--   latest_windows_version  newest Windows app version
--   min_windows_version     older versions are asked to update
--   installer_url           where the Windows installer is downloaded
create table public.remote_config (
  key text primary key check (key in ('signup_link', 'latest_windows_version', 'min_windows_version', 'installer_url')),
  value text not null default '' check (length(value) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.remote_config enable row level security;
insert into public.remote_config (key) values
  ('signup_link'), ('latest_windows_version'), ('min_windows_version'), ('installer_url');

create function public.get_remote_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(key, value) filter (where value <> ''), '{}'::jsonb) from public.remote_config
$$;

-- ---------------------------------------------------------------------------------------------
-- Question packs
-- ---------------------------------------------------------------------------------------------
-- A pack is one file per subject (see docs/offline-app-contracts.md for the format), built by a script
-- from published questions and uploaded to the private 'packs' bucket. Packs hold answers, so the file
-- is never public: downloads go through an edge function that checks the device or student and hands out
-- a short-lived link. This table is what that function and the manifest read.

create table public.content_packs (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id),
  version int not null check (version > 0),
  -- Bumped when the pack file format changes, so old apps can say "please update the app".
  schema_version int not null default 1,
  question_count int not null check (question_count > 0),
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  file_path text not null,
  published_at timestamptz not null default now(),
  is_current boolean not null default false,
  unique (subject_id, version)
);
create unique index content_packs_one_current on public.content_packs (subject_id) where is_current;
alter table public.content_packs enable row level security;

create function public.get_pack_manifest()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'subject', p.subject_id, 'version', p.version, 'schemaVersion', p.schema_version,
    'questions', p.question_count, 'bytes', p.size_bytes, 'sha256', p.sha256
  ) order by p.subject_id), '[]'::jsonb)
  from public.content_packs p
  where p.is_current
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('packs', 'packs', false, 104857600)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Leaderboard
-- ---------------------------------------------------------------------------------------------
-- XP already lives as one running total per student. A board for a week or a month needs XP by date,
-- so every finished session now writes a row here (by trigger, so the session functions stay untouched).

alter table public.profiles add column show_on_leaderboard boolean not null default true;

create table public.xp_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  xp int not null check (xp > 0)
);
create index xp_log_at_idx on public.xp_log (at);
create index xp_log_user_at_idx on public.xp_log (user_id, at);
alter table public.xp_log enable row level security;

-- Sessions finished before this migration.
insert into public.xp_log (user_id, at, xp)
select user_id, coalesce(submitted_at, started_at), (reward ->> 'xpGained')::int
from public.practice_sessions
where reward ? 'xpGained' and private.safe_int(reward ->> 'xpGained') > 0;

create function private.log_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_xp int := private.safe_int(new.reward ->> 'xpGained');
begin
  if v_xp is not null and v_xp > 0 then
    insert into public.xp_log (user_id, at, xp) values (new.user_id, coalesce(new.submitted_at, now()), v_xp);
  end if;
  return null;
end;
$$;

create trigger practice_sessions_log_xp
  after update on public.practice_sessions
  for each row
  when (old.status = 'in_progress' and new.status <> 'in_progress')
  execute function private.log_xp();

-- Top 20 for 'week' (Monday to Sunday), 'month' or 'all', Lagos time. Real accounts only: guests and students
-- who switched themselves off never appear. Names are first name and last initial. Callable without signing in
-- (school devices read it); when signed in, the caller's own row is marked and their rank returned even outside the top.
create function public.get_leaderboard(p_period text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_period text := case when p_period in ('week', 'month', 'all') then p_period else 'week' end;
  v_since timestamptz := case v_period
    when 'week' then date_trunc('week', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'
    when 'month' then date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'
    else '-infinity'::timestamptz
  end;
  v_me uuid := auth.uid();
  v_rows jsonb;
  v_mine jsonb;
begin
  with totals as (
    select x.user_id, sum(x.xp)::int as xp
    from public.xp_log x
    join public.profiles p on p.id = x.user_id
    join auth.users u on u.id = x.user_id
    where x.at >= v_since and p.show_on_leaderboard and p.display_name is not null and not u.is_anonymous
    group by x.user_id
  ),
  ranked as (
    select t.user_id, t.xp, rank() over (order by t.xp desc) as rank from totals t
  )
  select
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', r.rank, 'name', private.leaderboard_name(p.display_name), 'xp', r.xp, 'me', r.user_id = v_me
      ) order by r.rank, r.user_id)
      from (select * from ranked order by rank, user_id limit 20) r
      join public.profiles p on p.id = r.user_id
    ), '[]'::jsonb),
    (select jsonb_build_object('rank', r.rank, 'xp', r.xp) from ranked r where r.user_id = v_me)
  into v_rows, v_mine;

  return jsonb_build_object('period', v_period, 'since', case when v_period = 'all' then null else v_since end, 'rows', v_rows, 'me', v_mine);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin (service role only)
-- ---------------------------------------------------------------------------------------------

-- Every school with its activity in the last p_days days.
create function public.admin_schools(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz := now() - make_interval(days => v_days);
  v_out jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(r) order by r.sessions_completed desc, r.name), '[]'::jsonb) into v_out
  from (
    select
      s.id, s.name, s.state, s.area, s.phone, s.created_at, s.last_seen_at,
      (select count(*) from public.school_devices d where d.school_id = s.id) as devices,
      count(distinct e.device_id) as active_devices,
      count(*) filter (where e.kind = 'session_started') as sessions_started,
      count(*) filter (where e.kind = 'session_completed') as sessions_completed,
      coalesce(sum(private.safe_int(e.props ->> 'answered')) filter (where e.kind = 'session_completed'), 0) as questions_answered,
      count(distinct (e.at at time zone 'Africa/Lagos')::date) filter (where e.kind in ('session_started', 'session_completed')) as active_days
    from public.schools s
    left join public.school_events e on e.school_id = s.id and e.at >= v_since
    group by s.id
  ) r;
  return jsonb_build_object('days', v_days, 'schools', v_out);
end;
$$;

-- One school: devices, daily activity, subjects, modes, drop-offs and weakest topics.
create function public.admin_school_detail(p_school uuid, p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz := now() - make_interval(days => v_days);
  v_school jsonb;
  v_devices jsonb;
  v_daily jsonb;
  v_subjects jsonb;
  v_modes jsonb;
  v_funnel jsonb;
  v_topics jsonb;
  v_downloads jsonb;
begin
  select to_jsonb(s) - 'phone_key' into v_school from public.schools s where s.id = p_school;
  if v_school is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'label', d.prefix || '-' || lpad(d.number::text, 3, '0'),
    'os', d.os, 'app_version', d.app_version, 'last_seen_at', d.last_seen_at
  ) order by d.prefix, d.number), '[]'::jsonb) into v_devices
  from public.school_devices d where d.school_id = p_school;

  select coalesce(jsonb_agg(jsonb_build_object('day', x.day, 'sessions', x.sessions, 'questions', x.questions, 'devices', x.devices) order by x.day), '[]'::jsonb)
  into v_daily
  from (
    select (e.at at time zone 'Africa/Lagos')::date as day,
      count(*) filter (where e.kind = 'session_completed') as sessions,
      coalesce(sum(private.safe_int(e.props ->> 'answered')) filter (where e.kind = 'session_completed'), 0) as questions,
      count(distinct e.device_id) as devices
    from public.school_events e
    where e.school_id = p_school and e.at >= v_since and e.kind in ('session_started', 'session_completed')
    group by 1
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('subject', x.subject_id, 'sessions', x.sessions, 'answered', x.answered, 'correct', x.correct) order by x.sessions desc), '[]'::jsonb)
  into v_subjects
  from (
    select e.subject_id, count(*) as sessions,
      coalesce(sum(private.safe_int(e.props ->> 'answered')), 0) as answered,
      coalesce(sum(private.safe_int(e.props ->> 'correct')), 0) as correct
    from public.school_events e
    where e.school_id = p_school and e.at >= v_since and e.kind = 'session_completed' and e.subject_id is not null
    group by e.subject_id
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('mode', x.mode, 'sessions', x.sessions) order by x.sessions desc), '[]'::jsonb)
  into v_modes
  from (
    select e.mode, count(*) as sessions
    from public.school_events e
    where e.school_id = p_school and e.at >= v_since and e.kind = 'session_completed' and e.mode is not null
    group by e.mode
  ) x;

  select jsonb_build_object(
    'started', count(*) filter (where e.kind = 'session_started'),
    'completed', count(*) filter (where e.kind = 'session_completed'),
    'abandoned', count(*) filter (where e.kind = 'session_abandoned')
  ) into v_funnel
  from public.school_events e where e.school_id = p_school and e.at >= v_since;

  select coalesce(jsonb_agg(jsonb_build_object('topic', x.name, 'answered', x.answered, 'accuracy', x.accuracy) order by x.accuracy), '[]'::jsonb)
  into v_topics
  from (
    select t ->> 'name' as name,
      sum(private.safe_int(t ->> 'answered')) as answered,
      round(100.0 * sum(private.safe_int(t ->> 'correct')) / nullif(sum(private.safe_int(t ->> 'answered')), 0)) as accuracy
    from public.school_events e, jsonb_array_elements(
      case when jsonb_typeof(e.props -> 'per_topic') = 'array' then e.props -> 'per_topic' else '[]'::jsonb end
    ) t
    where e.school_id = p_school and e.at >= v_since and e.kind = 'session_completed'
    group by t ->> 'name'
    having sum(private.safe_int(t ->> 'answered')) >= 20
    order by 3
    limit 10
  ) x;

  select jsonb_build_object(
    'done', count(*) filter (where e.kind = 'pack_downloaded'),
    'failed', count(*) filter (where e.kind = 'pack_failed')
  ) into v_downloads
  from public.school_events e where e.school_id = p_school and e.at >= v_since;

  return jsonb_build_object(
    'days', v_days, 'school', v_school, 'devices', v_devices, 'daily', v_daily, 'subjects', v_subjects,
    'modes', v_modes, 'sessions', v_funnel, 'weak_topics', v_topics, 'downloads', v_downloads
  );
end;
$$;

-- Merges a duplicate school (for example from a mistyped phone number) into the one to keep.
-- Devices move across; a device whose label is already used there gets the next free number.
create function public.admin_merge_schools(p_keep uuid, p_merge uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.school_devices;
  v_number int;
  v_moved int := 0;
begin
  if p_keep is null or p_merge is null or p_keep = p_merge
    or not exists (select 1 from public.schools where id = p_keep)
    or not exists (select 1 from public.schools where id = p_merge)
  then
    raise exception 'invalid_merge' using errcode = 'P0001';
  end if;

  for d in select * from public.school_devices where school_id = p_merge order by prefix, number loop
    v_number := d.number;
    if exists (select 1 from public.school_devices where school_id = p_keep and prefix = d.prefix and number = v_number) then
      v_number := private.next_device_number(p_keep, d.prefix);
      if v_number is null then
        raise exception 'no_free_number' using errcode = 'P0001';
      end if;
    end if;
    update public.school_devices set school_id = p_keep, number = v_number where id = d.id;
    v_moved := v_moved + 1;
  end loop;

  update public.school_events set school_id = p_keep where school_id = p_merge;
  update public.schools k
  set last_seen_at = greatest(k.last_seen_at, (select m.last_seen_at from public.schools m where m.id = p_merge))
  where k.id = p_keep;
  delete from public.schools where id = p_merge;

  return jsonb_build_object('moved_devices', v_moved);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.lookup_school(text),
  public.register_school_device(uuid, text, text, text, text, text, int, text, text, boolean),
  public.school_sync(uuid, jsonb, text),
  public.get_campaigns(text),
  public.get_remote_config(),
  public.get_pack_manifest(),
  public.get_leaderboard(text)
to anon, authenticated;

grant execute on function
  public.admin_schools(int),
  public.admin_school_detail(uuid, int),
  public.admin_merge_schools(uuid, uuid)
to service_role;

grant select, insert, update, delete on public.campaigns, public.remote_config, public.content_packs to service_role;
grant select, update on public.schools to service_role;
grant select on public.school_devices, public.school_events, public.xp_log to service_role;
