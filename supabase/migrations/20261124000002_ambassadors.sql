-- Ambassadors: people who spread the word with a personal referral code and earn 20% of what the
-- students they bring in pay. They have their own sign-in, separate from student accounts, so a student
-- session on the same phone is never mixed up with an ambassador one.
--
-- Everything here is reached only from the server with the secret key (service_role). The tables have no
-- policies and no grants for the app's public key. The one exception is referral_owner(), which the
-- sign-up form uses to check a code.

create table public.ambassadors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 60),
  email text not null check (email = lower(email) and email like '%_@_%.__%'),
  password_hash text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);
create unique index ambassadors_email_key on public.ambassadors (email);
alter table public.ambassadors enable row level security;

-- Wrong-password log, so guessing a password is slowed down.
create table public.ambassador_attempts (
  email text not null,
  at timestamptz not null default now()
);
create index ambassador_attempts_idx on public.ambassador_attempts (email, at);
alter table public.ambassador_attempts enable row level security;

-- Money received from students. Empty until payments go live; the admin can record one by hand meanwhile.
-- Amounts are in kobo (100 kobo = 1 naira), so there is never a fraction of a naira to round.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_kobo int not null check (amount_kobo > 0),
  note text,
  paid_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id);
alter table public.payments enable row level security;

-- Who brought each student in. The code typed or carried by the link is kept as well, as it was.
alter table public.profiles add column referred_by uuid references public.ambassadors (id) on delete set null;
create index profiles_referred_by_idx on public.profiles (referred_by) where referred_by is not null;

grant select, insert, update, delete on public.ambassadors, public.ambassador_attempts, public.payments to service_role;
revoke all on public.ambassadors, public.ambassador_attempts, public.payments from anon, authenticated;

-- Codes -------------------------------------------------------------------------

-- Six characters, none that look alike (0/O, 1/I).
create function private.new_ambassador_code()
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
    exit when not exists (select 1 from public.ambassadors where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Attribution ---------------------------------------------------------------------

-- A student's account carries the code in its metadata (put there at sign-up, from the link or the box).
-- This runs when the account is made and when a guest upgrades to a real account, so it does not matter
-- which device or browser finishes the sign-up. The first valid code wins and is never changed after.
create function private.attribute_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(new.raw_user_meta_data ->> 'referral_code', ''), '[^A-Za-z0-9]', '', 'g'));
  v_ambassador uuid;
begin
  if length(v_code) <> 6 then return new; end if;
  select id into v_ambassador from public.ambassadors where code = v_code;
  if v_ambassador is null then return new; end if;
  update public.profiles
  set referral_code_used = v_code, referred_by = v_ambassador
  where id = new.id and referred_by is null;
  return new;
end;
$$;

create trigger on_auth_user_referral
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function private.attribute_referral();

-- The sign-up form and the referral page use this: the ambassador's first name for a code, or null.
create function public.referral_owner(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(trim(name), ' ', 1)
  from public.ambassadors
  where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

revoke all on function public.referral_owner(text) from public;
grant execute on function public.referral_owner(text) to anon, authenticated, service_role;

-- Ambassador accounts -------------------------------------------------------------

create function public.ambassador_signup(p_name text, p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  if lower(trim(coalesce(p_email, ''))) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'invalid_email' using errcode = 'P0001'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'weak_password' using errcode = 'P0001'; end if;
  if exists (select 1 from public.ambassadors where email = lower(trim(p_email))) then
    raise exception 'email_taken' using errcode = 'P0001';
  end if;
  insert into public.ambassadors (name, email, password_hash, code)
  values (trim(p_name), lower(trim(p_email)), extensions.crypt(p_password, extensions.gen_salt('bf')), private.new_ambassador_code())
  returning id into v_id;
  return v_id;
end;
$$;

-- Returns the ambassador's id when the password is right, null when it is wrong. Five wrong tries in
-- fifteen minutes lock that address for a while, whatever is typed next.
create function public.ambassador_login(p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_row public.ambassadors;
begin
  delete from public.ambassador_attempts where at < now() - interval '1 day';
  if (select count(*) from public.ambassador_attempts where email = v_email and at > now() - interval '15 minutes') >= 5 then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  select * into v_row from public.ambassadors where email = v_email;
  if v_row.id is not null and v_row.password_hash = extensions.crypt(coalesce(p_password, ''), v_row.password_hash) then
    delete from public.ambassador_attempts where email = v_email;
    return v_row.id;
  end if;
  insert into public.ambassador_attempts (email) values (v_email);
  return null;
end;
$$;

-- What the ambassador sees: the numbers, and their people by first name only.
create function public.ambassador_stats(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select p.id, p.created_at, coalesce(nullif(split_part(trim(coalesce(p.display_name, '')), ' ', 1), ''), 'A student') as first_name,
           coalesce((select sum(amount_kobo) from public.payments pay where pay.user_id = p.id), 0)::int as paid_kobo
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.referred_by = p_id and not u.is_anonymous
  )
  select jsonb_build_object(
    'signups', (select count(*) from mine),
    'paid', (select count(*) from mine where paid_kobo > 0),
    'earned_kobo', (select coalesce(sum(paid_kobo), 0) * 20 / 100 from mine),
    'commission_percent', 20,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('name', first_name, 'joined', created_at, 'paid', paid_kobo > 0) order by created_at desc)
      from (select * from mine order by created_at desc limit 100) m
    ), '[]'::jsonb)
  )
$$;

-- Admin view of every ambassador and the students each one brought in.
create function public.admin_ambassadors()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(a order by (a ->> 'created_at') desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', amb.id, 'name', amb.name, 'email', amb.email, 'code', amb.code, 'created_at', amb.created_at,
      'signups', count(m.id), 'paid', count(m.id) filter (where m.paid_kobo > 0),
      'earned_kobo', coalesce(sum(m.paid_kobo), 0) * 20 / 100,
      'people', coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.display_name, 'email', m.email, 'joined', m.created_at, 'paid_kobo', m.paid_kobo
      ) order by m.created_at desc) filter (where m.id is not null), '[]'::jsonb)
    ) as a
    from public.ambassadors amb
    left join (
      select p.id, p.display_name, p.referred_by, p.created_at, u.email,
             coalesce((select sum(amount_kobo) from public.payments pay where pay.user_id = p.id), 0)::int as paid_kobo
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.referred_by is not null and not u.is_anonymous
    ) m on m.referred_by = amb.id
    group by amb.id
  ) t
$$;

revoke all on function
  public.ambassador_signup(text, text, text),
  public.ambassador_login(text, text),
  public.ambassador_stats(uuid),
  public.admin_ambassadors()
from public, anon, authenticated;
grant execute on function
  public.ambassador_signup(text, text, text),
  public.ambassador_login(text, text),
  public.ambassador_stats(uuid),
  public.admin_ambassadors()
to service_role;
