-- Admin sign-in lockout that survives across server instances.
--
-- When ADMIN_PASSWORD is set in the environment the password is checked in the app, and wrong guesses used to be
-- counted in that one server's memory. On a host that runs many short-lived instances that count resets all the
-- time. These two functions keep the count in the database, in the same table the older password check uses:
-- five wrong guesses in fifteen minutes lock sign-in for everyone until the window passes.

create or replace function public.admin_login_locked()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.admin_attempts where at < now() - interval '1 day';
  return (select count(*) from public.admin_attempts where at > now() - interval '15 minutes') >= 5;
end;
$$;

create or replace function public.admin_login_result(p_ok boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_ok then
    delete from public.admin_attempts where true;
  else
    insert into public.admin_attempts default values;
  end if;
end;
$$;

revoke execute on function public.admin_login_locked(), public.admin_login_result(boolean) from public, anon, authenticated;
grant execute on function public.admin_login_locked(), public.admin_login_result(boolean) to service_role;
