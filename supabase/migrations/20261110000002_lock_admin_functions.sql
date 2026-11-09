-- Security fix, found while testing the offline apps migration.
--
-- Functions created in Postgres are executable by PUBLIC unless that is revoked. The project's earlier
-- "alter default privileges in schema public revoke ... from public" does not remove that built-in default,
-- so every function created after the one-off revoke in 20261107000003 stayed callable with the public (anon) key.
-- That included the admin functions: anyone holding the public key could call admin_set_password(),
-- admin_password_hash() and admin_overview(), and read every push subscription through reminder_audience().
--
-- The admin pages and the send-reminders function already use the secret key (service_role), so nothing
-- legitimate loses access.

revoke execute on function
  public.admin_merge_schools(uuid, uuid),
  public.admin_overview(int),
  public.admin_overview_prev(int),
  public.admin_password_hash(),
  public.admin_school_detail(uuid, int),
  public.admin_schools(int),
  public.admin_set_password(text),
  public.admin_verify_password(text),
  public.reminder_audience()
from public, anon, authenticated;

grant execute on function
  public.admin_merge_schools(uuid, uuid),
  public.admin_overview(int),
  public.admin_overview_prev(int),
  public.admin_password_hash(),
  public.admin_school_detail(uuid, int),
  public.admin_schools(int),
  public.admin_set_password(text),
  public.admin_verify_password(text),
  public.reminder_audience()
to service_role;

-- From now on a new function is private until it is granted explicitly, which is how this project already works.
alter default privileges revoke execute on functions from public;

-- Leaderboard: a signed-out caller's rows now say me = false instead of null.
create or replace function public.get_leaderboard(p_period text default 'week')
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
        'rank', r.rank, 'name', private.leaderboard_name(p.display_name), 'xp', r.xp,
        'me', coalesce(r.user_id = v_me, false)
      ) order by r.rank, r.user_id)
      from (select * from ranked order by rank, user_id limit 20) r
      join public.profiles p on p.id = r.user_id
    ), '[]'::jsonb),
    (select jsonb_build_object('rank', r.rank, 'xp', r.xp) from ranked r where r.user_id = v_me)
  into v_rows, v_mine;

  return jsonb_build_object('period', v_period, 'since', case when v_period = 'all' then null else v_since end, 'rows', v_rows, 'me', v_mine);
end;
$$;
