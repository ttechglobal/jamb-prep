-- Study partners: invite a friend, see each other's streak and whether they practised today, and
-- nudge them. No chat. Everything goes through the functions below; the tables have no policies
-- and no grants, so students never read each other's rows directly.
--
-- Not applied to the database yet. Review, then apply.

-- A short code on each profile, made the first time the student asks for it. It is the whole invite:
-- the link is /join/CODE, and a friend can also type the code. No letters that look alike (0/O, 1/I).
alter table public.profiles add column partner_code text unique;

create function private.new_partner_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where partner_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- user_a asked, user_b was asked. Declining or removing a partner deletes the row.
create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (user_a <> user_b)
);
create unique index partnerships_pair_key on public.partnerships (least(user_a, user_b), greatest(user_a, user_b));
create index partnerships_a_idx on public.partnerships (user_a);
create index partnerships_b_idx on public.partnerships (user_b);
alter table public.partnerships enable row level security;

-- What each student promises themselves, on their own. 'sessions': rounds a day (1 to 3).
-- 'questions': questions a day (5 to 100). One commitment per student, shared by all their partners.
create table public.partner_commitments (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kind text not null check (kind in ('sessions', 'questions')),
  amount int not null,
  updated_at timestamptz not null default now(),
  check ((kind = 'sessions' and amount between 1 and 3) or (kind = 'questions' and amount between 5 and 100))
);
alter table public.partner_commitments enable row level security;

-- In-app notices. The unique key also makes a nudge once a day per person, and "practised" once a day.
create table public.partner_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  actor uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('request', 'joined', 'nudge', 'practised')),
  day date not null default (now() at time zone 'Africa/Lagos')::date,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, actor, kind, day)
);
create index partner_events_user_idx on public.partner_events (user_id, created_at desc);
alter table public.partner_events enable row level security;

-- Helpers (not callable from the app) -----------------------------------------

create function private.lagos_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Africa/Lagos')::date $$;

create function private.first_name(p_user uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(split_part(trim(display_name), ' ', 1), ''), 'A friend')
  from public.profiles where id = p_user
$$;

-- 'not_yet' (nothing today), 'started' (some, but under their own commitment), 'done'.
-- With no commitment set, any practice today counts as done.
create function private.today_status(p_user uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_start timestamptz := private.lagos_today()::timestamp at time zone 'Africa/Lagos';
  v_q int;
  v_s int;
  c public.partner_commitments;
begin
  select count(*), count(distinct session_id) into v_q, v_s
  from public.practice_answers where user_id = p_user and answered_at >= v_start;
  if v_q = 0 then return 'not_yet'; end if;

  select * into c from public.partner_commitments where user_id = p_user;
  if not found then return 'done'; end if;
  if (c.kind = 'sessions' and v_s >= c.amount) or (c.kind = 'questions' and v_q >= c.amount) then
    return 'done';
  end if;
  return 'started';
end;
$$;

-- A streak that has lapsed reads as 0 even before the next practice resets the stored number.
create function private.live_streak(p_user uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select case when last_practice_day >= private.lagos_today() - 1 then current_streak else 0 end
    from public.player_progress where user_id = p_user
  ), 0)
$$;

create function private.require_account()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  if private.is_guest() then
    raise exception 'account_required' using errcode = 'P0001';
  end if;
  return v_user;
end;
$$;

-- Functions the app calls ---------------------------------------------------------

create function public.my_partner_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
  v_code text;
begin
  select partner_code into v_code from public.profiles where id = v_user;
  if v_code is null then
    update public.profiles set partner_code = private.new_partner_code()
    where id = v_user and partner_code is null
    returning partner_code into v_code;
    if v_code is null then
      select partner_code into v_code from public.profiles where id = v_user;
    end if;
  end if;
  return v_code;
end;
$$;

-- Who an invite link is from, so the join page can say "Tolu invited you" before sign-in.
create function public.partner_code_owner(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.first_name(id) from public.profiles
  where partner_code = upper(trim(p_code)) and display_name is not null
$$;

-- Asks the owner of a code to be a study partner. If they had already asked you, it just accepts.
-- Returns { status: 'pending' | 'active', to, from } so the server can send the push.
create function public.request_partner(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
  v_target uuid;
  v_existing public.partnerships;
begin
  select id into v_target from public.profiles where partner_code = upper(trim(p_code));
  if v_target is null then raise exception 'invalid_code' using errcode = 'P0001'; end if;
  if v_target = v_user then raise exception 'own_code' using errcode = 'P0001'; end if;

  select * into v_existing from public.partnerships
  where least(user_a, user_b) = least(v_user, v_target) and greatest(user_a, user_b) = greatest(v_user, v_target);

  if found then
    if v_existing.status = 'active' then
      raise exception 'already_partners' using errcode = 'P0001';
    elsif v_existing.user_b = v_user then
      update public.partnerships set status = 'active', accepted_at = now() where id = v_existing.id;
      insert into public.partner_events (user_id, actor, kind) values (v_target, v_user, 'joined') on conflict do nothing;
      return jsonb_build_object('status', 'active', 'to', v_target, 'from', private.first_name(v_user));
    else
      return jsonb_build_object('status', 'pending', 'to', null, 'from', private.first_name(v_user));
    end if;
  end if;

  if (select count(*) from public.partnerships where user_a = v_user or user_b = v_user) >= 5 then
    raise exception 'too_many_partners' using errcode = 'P0001';
  end if;

  insert into public.partnerships (user_a, user_b) values (v_user, v_target);
  insert into public.partner_events (user_id, actor, kind) values (v_target, v_user, 'request') on conflict do nothing;
  return jsonb_build_object('status', 'pending', 'to', v_target, 'from', private.first_name(v_user));
end;
$$;

create function public.respond_partner(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
  v_row public.partnerships;
begin
  select * into v_row from public.partnerships where id = p_id and user_b = v_user and status = 'pending';
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  if not p_accept then
    delete from public.partnerships where id = p_id;
    return jsonb_build_object('status', 'declined', 'to', null, 'from', null);
  end if;

  if (select count(*) from public.partnerships where (user_a = v_user or user_b = v_user) and status = 'active') >= 5 then
    raise exception 'too_many_partners' using errcode = 'P0001';
  end if;

  update public.partnerships set status = 'active', accepted_at = now() where id = p_id;
  insert into public.partner_events (user_id, actor, kind) values (v_row.user_a, v_user, 'joined') on conflict do nothing;
  return jsonb_build_object('status', 'active', 'to', v_row.user_a, 'from', private.first_name(v_user));
end;
$$;

create function public.remove_partner(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
begin
  delete from public.partnerships where id = p_id and (user_a = v_user or user_b = v_user);
end;
$$;

create function public.set_commitment(p_kind text, p_amount int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
begin
  if p_kind is null or p_amount is null
     or not ((p_kind = 'sessions' and p_amount between 1 and 3) or (p_kind = 'questions' and p_amount between 5 and 100)) then
    raise exception 'invalid_commitment' using errcode = 'P0001';
  end if;
  insert into public.partner_commitments (user_id, kind, amount, updated_at)
  values (v_user, p_kind, p_amount, now())
  on conflict (user_id) do update set kind = excluded.kind, amount = excluded.amount, updated_at = now();
end;
$$;

-- Everything the partners screen and the Practice card need, in one call.
create function public.get_partners()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
  v_today date := private.lagos_today();
  v_commit public.partner_commitments;
  v_active jsonb;
  v_incoming jsonb;
  v_outgoing jsonb;
  v_events jsonb;
begin
  select * into v_commit from public.partner_commitments where user_id = v_user;

  select coalesce(jsonb_agg(item order by (item ->> 'name')), '[]'::jsonb) into v_active
  from (
    select jsonb_build_object(
      'id', p.id,
      'userId', o.uid,
      'name', private.first_name(o.uid),
      'streak', private.live_streak(o.uid),
      'today', private.today_status(o.uid),
      'commitment', (select jsonb_build_object('kind', c.kind, 'amount', c.amount) from public.partner_commitments c where c.user_id = o.uid),
      'nudgedByMe', exists (
        select 1 from public.partner_events e
        where e.user_id = o.uid and e.actor = v_user and e.kind = 'nudge' and e.day = v_today
      )
    ) as item
    from public.partnerships p
    cross join lateral (select case when p.user_a = v_user then p.user_b else p.user_a end as uid) o
    where p.status = 'active' and (p.user_a = v_user or p.user_b = v_user)
  ) s;

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', private.first_name(p.user_a)) order by p.created_at), '[]'::jsonb)
  into v_incoming
  from public.partnerships p where p.user_b = v_user and p.status = 'pending';

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', private.first_name(p.user_b)) order by p.created_at), '[]'::jsonb)
  into v_outgoing
  from public.partnerships p where p.user_a = v_user and p.status = 'pending';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'name', private.first_name(e.actor), 'at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb)
  into v_events
  from (select * from public.partner_events where user_id = v_user and read_at is null order by created_at desc limit 20) e;

  return jsonb_build_object(
    'commitment', case when v_commit.user_id is null then null else jsonb_build_object('kind', v_commit.kind, 'amount', v_commit.amount) end,
    'today', private.today_status(v_user),
    'partners', v_active,
    'incoming', v_incoming,
    'outgoing', v_outgoing,
    'events', v_events
  );
end;
$$;

-- One nudge per partner per day, and only while they haven't finished their day.
-- Returns { to, from } so the server can send the push.
create function public.send_nudge(p_partnership uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
  v_row public.partnerships;
  v_to uuid;
  v_inserted int;
begin
  select * into v_row from public.partnerships
  where id = p_partnership and status = 'active' and (user_a = v_user or user_b = v_user);
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  v_to := case when v_row.user_a = v_user then v_row.user_b else v_row.user_a end;
  if private.today_status(v_to) = 'done' then raise exception 'already_practised' using errcode = 'P0001'; end if;

  insert into public.partner_events (user_id, actor, kind) values (v_to, v_user, 'nudge') on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then raise exception 'already_nudged' using errcode = 'P0001'; end if;

  return jsonb_build_object('to', v_to, 'from', private.first_name(v_user));
end;
$$;

-- Called after a round finishes. Tells each partner, once a day, that this student has practised.
-- Returns the partners newly told, so the server can send the push.
create function public.notify_practised()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
  v_to jsonb;
begin
  if private.today_status(v_user) = 'not_yet' then
    return jsonb_build_object('to', '[]'::jsonb, 'from', private.first_name(v_user));
  end if;

  with partners as (
    select case when user_a = v_user then user_b else user_a end as uid
    from public.partnerships where status = 'active' and (user_a = v_user or user_b = v_user)
  ), ins as (
    insert into public.partner_events (user_id, actor, kind)
    select uid, v_user, 'practised' from partners
    on conflict do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(user_id), '[]'::jsonb) into v_to from ins;

  return jsonb_build_object('to', v_to, 'from', private.first_name(v_user));
end;
$$;

create function public.mark_partner_events_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
begin
  update public.partner_events set read_at = now() where user_id = v_user and read_at is null;
end;
$$;

grant execute on function
  public.my_partner_code(),
  public.partner_code_owner(text),
  public.request_partner(text),
  public.respond_partner(uuid, boolean),
  public.remove_partner(uuid),
  public.set_commitment(text, int),
  public.get_partners(),
  public.send_nudge(uuid),
  public.notify_practised(),
  public.mark_partner_events_read()
to authenticated;

-- The join page says who an invite is from before the visitor has any session.
grant execute on function public.partner_code_owner(text) to anon;

-- Event names for the partner screens (the whitelist is the full list, as in the previous migration).
create or replace function public.track_event(p_visitor text, p_name text, p_props jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_name not in (
    'landing_view', 'start_click', 'round_started', 'round_completed', 'free_limit_reached',
    'register_view', 'register_submitted', 'onboarding_done',
    'game_started', 'game_completed', 'install_accepted', 'reminders_enabled',
    'leaderboard_view', 'landing_card_click', 'landing_start_click',
    'needs_work_shown', 'needs_work_tapped',
    'partner_invite_shared', 'partner_request_sent', 'partner_accepted', 'partner_nudge_sent', 'partner_commitment_set'
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
