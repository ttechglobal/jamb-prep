-- The database refuses DELETE without a WHERE clause, so clearing the attempt log says what it clears.
create or replace function public.admin_verify_password(p_password text)
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
