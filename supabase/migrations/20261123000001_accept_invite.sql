-- An invite link is the inviter's own consent: someone who signs up from it becomes a study partner
-- straight away, with no request for the inviter to accept. Typing a code by hand still sends a request.
-- Returns { status: 'active', to, from } so the server can tell the inviter.
create function public.accept_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_account();
  v_inviter uuid;
  v_existing public.partnerships;
begin
  select id into v_inviter from public.profiles where partner_code = upper(trim(p_code));
  if v_inviter is null then raise exception 'invalid_code' using errcode = 'P0001'; end if;
  if v_inviter = v_user then raise exception 'own_code' using errcode = 'P0001'; end if;

  select * into v_existing from public.partnerships
  where least(user_a, user_b) = least(v_user, v_inviter) and greatest(user_a, user_b) = greatest(v_user, v_inviter);

  if found then
    if v_existing.status = 'active' then raise exception 'already_partners' using errcode = 'P0001'; end if;
    update public.partnerships set status = 'active', accepted_at = now() where id = v_existing.id;
  else
    -- Both people have a limit, so a link cannot push the inviter past it.
    if (select count(*) from public.partnerships where user_a = v_user or user_b = v_user) >= 5 then
      raise exception 'too_many_partners' using errcode = 'P0001';
    end if;
    if (select count(*) from public.partnerships where (user_a = v_inviter or user_b = v_inviter) and status = 'active') >= 5 then
      raise exception 'too_many_partners' using errcode = 'P0001';
    end if;
    insert into public.partnerships (user_a, user_b, status, accepted_at) values (v_inviter, v_user, 'active', now());
  end if;

  insert into public.partner_events (user_id, actor, kind) values (v_inviter, v_user, 'joined') on conflict do nothing;
  return jsonb_build_object('status', 'active', 'to', v_inviter, 'from', private.first_name(v_user));
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
