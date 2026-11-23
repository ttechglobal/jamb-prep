-- Study times and the two-day partner alert.
--
-- A student sets up to three study times (a time of day, and which days). At that time they get a
-- reminder, unless they have already practised that day. Separately, when a study partner has not
-- practised for two days in a row, the other partner is told once. Both are sent by a job that calls
-- /api/cron/study every fifteen minutes (see scripts/setup-study-reminders.mjs).
-- Days are Lagos days, as everywhere else. Weekdays are ISO numbers: 1 is Monday and 7 is Sunday.

create table public.study_times (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  at_time time not null,
  days smallint[] not null,
  created_at timestamptz not null default now(),
  check (cardinality(days) between 1 and 7)
);
create index study_times_user_idx on public.study_times (user_id);
alter table public.study_times enable row level security;

-- What has already been sent, so a reminder or an alert goes out once.
create table public.study_reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  at_time time not null,
  primary key (user_id, day, at_time)
);
alter table public.study_reminder_log enable row level security;

create table public.partner_alert_log (
  user_id uuid not null references auth.users (id) on delete cascade, -- who was told
  about uuid not null references auth.users (id) on delete cascade,   -- who has not practised
  since date not null,                                                -- the last day they practised
  created_at timestamptz not null default now(),
  primary key (user_id, about, since)
);
alter table public.partner_alert_log enable row level security;

create function public.get_study_times()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'time', to_char(at_time, 'HH24:MI'), 'days', days) order by at_time)
    from public.study_times where user_id = v_user
  ), '[]'::jsonb);
end;
$$;

-- Replaces the student's study times with the list given: [{ "time": "18:30", "days": [1,2,3,4,5] }, ...].
create function public.set_study_times(p_times jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
  v_item jsonb;
  v_time text;
  v_days smallint[];
  v_seen text[] := '{}';
begin
  if p_times is null or jsonb_typeof(p_times) <> 'array' or jsonb_array_length(p_times) > 3 then
    raise exception 'invalid_study_times' using errcode = 'P0001';
  end if;

  delete from public.study_times where user_id = v_user;

  for v_item in select * from jsonb_array_elements(p_times) loop
    v_time := v_item ->> 'time';
    if v_time is null or v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_time = any (v_seen) then
      raise exception 'invalid_study_times' using errcode = 'P0001';
    end if;
    if jsonb_typeof(v_item -> 'days') <> 'array' then
      raise exception 'invalid_study_times' using errcode = 'P0001';
    end if;
    select coalesce(array_agg(distinct d::smallint order by d::smallint), '{}') into v_days
    from jsonb_array_elements_text(v_item -> 'days') as d
    where d ~ '^[1-7]$';
    if cardinality(v_days) = 0 or cardinality(v_days) <> jsonb_array_length(v_item -> 'days') then
      raise exception 'invalid_study_times' using errcode = 'P0001';
    end if;
    v_seen := v_seen || v_time;
    insert into public.study_times (user_id, at_time, days) values (v_user, v_time::time, v_days);
  end loop;
end;
$$;

-- How long each active study partner has gone without practising, so the app can say so.
-- { "<their id>": { "days": 2 } }. days is null for someone who has never practised.
create function public.get_partner_gaps()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
  v_today date := private.lagos_today();
begin
  return coalesce((
    select jsonb_object_agg(o.uid::text, jsonb_build_object('days', case when l.last_day is null then null else v_today - l.last_day end))
    from public.partnerships p
    cross join lateral (select case when p.user_a = v_user then p.user_b else p.user_a end as uid) o
    cross join lateral (
      select max((a.answered_at at time zone 'Africa/Lagos')::date) as last_day
      from public.practice_answers a where a.user_id = o.uid
    ) l
    where p.status = 'active' and (p.user_a = v_user or p.user_b = v_user)
  ), '{}'::jsonb);
end;
$$;

-- Who is due a study-time reminder right now. A time counts for the half hour after it, and each one is
-- logged as it is claimed, so nobody is reminded twice. Anyone who has practised today is left alone.
create function public.study_reminders_due(p_now timestamptz default now())
returns table (uid uuid, first_name text, slot time, promise_kind text, promise_amount int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp := p_now at time zone 'Africa/Lagos';
  v_day date := v_local::date;
  v_dow smallint := extract(isodow from v_local)::smallint;
  v_now_min int := (extract(hour from v_local) * 60 + extract(minute from v_local))::int;
begin
  return query
  with due as (
    select st.user_id as who, st.at_time as at
    from public.study_times st
    where v_dow = any (st.days)
      and v_now_min - (extract(hour from st.at_time) * 60 + extract(minute from st.at_time))::int between 0 and 29
      and not exists (
        select 1 from public.practice_answers a
        where a.user_id = st.user_id and (a.answered_at at time zone 'Africa/Lagos')::date = v_day
      )
  ), claimed as (
    insert into public.study_reminder_log as l (user_id, day, at_time)
    select d.who, v_day, d.at from due d
    on conflict do nothing
    returning l.user_id as who, l.at_time as at
  )
  select c.who, private.first_name(c.who), c.at, pc.kind, pc.amount
  from claimed c
  left join public.partner_commitments pc on pc.user_id = c.who;
end;
$$;

-- Partners to tell that someone has not practised for two days in a row: they last practised three or more
-- days ago (or, if they never have, they joined as partners that long ago). It waits until 8:00 Lagos, and
-- each gap is announced once, however long it lasts.
create function public.partner_alerts_due(p_now timestamptz default now())
returns table (uid uuid, about_uid uuid, about_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp := p_now at time zone 'Africa/Lagos';
  v_today date := v_local::date;
begin
  if v_local::time < time '08:00' then
    return;
  end if;

  return query
  with pairs as (
    select p.user_a as quiet, p.user_b as told, p.accepted_at from public.partnerships p where p.status = 'active'
    union all
    select p.user_b, p.user_a, p.accepted_at from public.partnerships p where p.status = 'active'
  ), gaps as (
    select pr.quiet, pr.told,
      greatest(
        coalesce((select max((a.answered_at at time zone 'Africa/Lagos')::date) from public.practice_answers a where a.user_id = pr.quiet), date '1900-01-01'),
        (coalesce(pr.accepted_at, p_now) at time zone 'Africa/Lagos')::date
      ) as last_day
    from pairs pr
  ), due as (
    select g.quiet, g.told, g.last_day from gaps g where v_today - g.last_day >= 3
  ), claimed as (
    insert into public.partner_alert_log as l (user_id, about, since)
    select d.told, d.quiet, d.last_day from due d
    on conflict do nothing
    returning l.user_id as told, l.about as quiet
  )
  select c.told, c.quiet, private.first_name(c.quiet) from claimed c;
end;
$$;

revoke all on function public.study_reminders_due(timestamptz), public.partner_alerts_due(timestamptz) from public, anon, authenticated;
grant execute on function public.study_reminders_due(timestamptz), public.partner_alerts_due(timestamptz) to service_role;

revoke all on function public.get_study_times(), public.set_study_times(jsonb), public.get_partner_gaps() from public, anon;
grant execute on function public.get_study_times(), public.set_study_times(jsonb), public.get_partner_gaps() to authenticated;
