-- Reminder notifications. One row per browser or phone a student turned reminders on for.
-- Students register and remove their own through functions; only the server's notification job reads
-- the keys, using the service role, which bypasses row-level security.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
-- No policies and no grants: nothing reaches this table except through the two functions below.

-- A browser has one endpoint. If another account used the same browser before, the endpoint moves to the current student.
create function public.register_push(p_endpoint text, p_p256dh text, p_auth text)
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
  if length(coalesce(p_endpoint, '')) not between 10 and 2000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'invalid_subscription' using errcode = 'P0001';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_user, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create function public.unregister_push(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = v_user;
end;
$$;

grant execute on function public.register_push(text, text, text) to authenticated;
grant execute on function public.unregister_push(text) to authenticated;
