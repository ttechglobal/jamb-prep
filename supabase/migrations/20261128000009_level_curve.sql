-- Levels: a gentler start, matching lib/game/rules.ts.
--
-- Total XP to reach level n is 10 * (n - 1) * (n + 3): 50 XP for level 2, 120 for level 3, 1,170 for level 10.
-- This is its inverse. The results screen reads levelBefore and levelAfter from the round's reward, so the server
-- and the app must agree. A tiny epsilon keeps an exact boundary (50 XP) from rounding down.

create or replace function private.level_for(p_xp int)
returns int
language sql
immutable
set search_path = ''
as $$
  select floor(sqrt(4 + greatest(p_xp, 0) / 10.0) - 1 + 1e-9)::int;
$$;
