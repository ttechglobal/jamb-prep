-- Game progress can now be saved for every game, not only Concord.
alter table public.game_progress drop constraint game_progress_game_check;
alter table public.game_progress add constraint game_progress_game_check check (game ~ '^[a-z][a-z0-9-]{1,40}$');

create or replace function public.save_game_progress(p_game text, p_data jsonb)
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
  if p_game !~ '^[a-z][a-z0-9-]{1,40}$' or p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 2000 then
    raise exception 'invalid_progress' using errcode = 'P0001';
  end if;
  insert into public.game_progress (user_id, game, data, updated_at)
  values (v_user, p_game, p_data, now())
  on conflict (user_id, game) do update set data = excluded.data, updated_at = now();
end;
$$;
