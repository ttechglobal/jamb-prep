-- The event whitelist was missing names the app already sends (leaderboard_view), so those events
-- were silently dropped. Adds them, plus the landing card and "work on this" events.

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
    'needs_work_shown', 'needs_work_tapped'
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
