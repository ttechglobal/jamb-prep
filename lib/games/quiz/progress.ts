"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppState } from "@/lib/app-state";
import { supabase } from "@/lib/supabase/client";
import { MIXED_ID, type QuizGame } from "./games";

/**
 * Stars per level for one quiz game. Kept on this device (so it works at once and offline) and saved to the
 * student's account when signed in, the better score always winning. Nothing here ever throws.
 */
export interface QuizProgress {
  stars: Record<string, number>;
  mixedBest: number;
}

const empty = (): QuizProgress => ({ stars: {}, mixedBest: 0 });
const keyOf = (gameId: string) => `jambprep:quiz:${gameId}:v1`;

function read(gameId: string): QuizProgress {
  try {
    const raw = window.localStorage.getItem(keyOf(gameId));
    if (!raw) return empty();
    const p = JSON.parse(raw) as Partial<QuizProgress>;
    return { stars: p.stars ?? {}, mixedBest: p.mixedBest ?? 0 };
  } catch {
    return empty();
  }
}

function write(gameId: string, p: QuizProgress) {
  try {
    window.localStorage.setItem(keyOf(gameId), JSON.stringify(p));
  } catch {
    // Not saved this time. The game still works.
  }
}

function merge(a: QuizProgress, b: QuizProgress): QuizProgress {
  const stars = { ...a.stars };
  for (const [id, n] of Object.entries(b.stars ?? {})) stars[id] = Math.max(stars[id] ?? 0, Number(n) || 0);
  return { stars, mixedBest: Math.max(a.mixedBest, Number(b.mixedBest) || 0) };
}

const canon = (p: QuizProgress) => JSON.stringify([Object.entries(p.stars).sort(), p.mixedBest]);

async function saveRemote(gameId: string, p: QuizProgress) {
  try {
    await supabase().rpc("save_game_progress", { p_game: gameId, p_data: p });
  } catch {
    // Offline, or the server does not know this game yet. The device copy is kept.
  }
}

/** A level opens once the one before it has a star. The first is always open. */
export function isUnlocked(game: { levels: { id: string }[] }, p: QuizProgress, levelId: string) {
  const i = game.levels.findIndex((l) => l.id === levelId);
  return i <= 0 || (p.stars[game.levels[i - 1].id] ?? 0) >= 1;
}

export function mixedUnlocked(game: { levels: { id: string }[] }, p: QuizProgress) {
  return game.levels.slice(0, 2).every((l) => (p.stars[l.id] ?? 0) >= 1);
}

export function useQuizProgress(game: Pick<QuizGame, "id">) {
  const { hydrated, account } = useAppState();
  const signedIn = Boolean(account);
  const [progress, setProgress] = useState<QuizProgress>(empty);
  const [ready, setReady] = useState(false);
  const signedInRef = useRef(signedIn);
  const id = game.id;

  useEffect(() => {
    signedInRef.current = signedIn;
  }, [signedIn]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(read(id));
    setReady(true);
  }, [id]);

  useEffect(() => {
    if (!hydrated || !signedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase().rpc("get_game_progress", { p_game: id });
        if (error || cancelled) return;
        const server = merge(empty(), (data ?? {}) as QuizProgress);
        const merged = merge(read(id), server);
        write(id, merged);
        setProgress(merged);
        if (canon(merged) !== canon(server)) await saveRemote(id, merged);
      } catch {
        // Offline: keep playing with the device copy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, signedIn, id]);

  const record = useCallback(
    (levelId: string, stars: number, correct: number) => {
      const cur = read(id);
      const next: QuizProgress =
        levelId === MIXED_ID
          ? { ...cur, mixedBest: Math.max(cur.mixedBest, correct) }
          : { ...cur, stars: { ...cur.stars, [levelId]: Math.max(cur.stars[levelId] ?? 0, stars) } };
      write(id, next);
      setProgress(next);
      if (signedInRef.current) void saveRemote(id, next);
    },
    [id],
  );

  return { progress, ready, record };
}
