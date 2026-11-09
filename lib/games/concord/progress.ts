"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppState } from "@/lib/app-state";
import { supabase } from "@/lib/supabase/client";
import { CONCORD_LEVELS, MIXED_ID } from "./levels";

/**
 * Stars per level. They are kept on this device (so the game works at once and offline) and saved to the
 * student's account, so progress follows them to a new phone. The better score always wins when the two
 * are combined. Reads and writes never throw, since storage can be blocked and the network can drop.
 */
const KEY = "jambprep:concord:v1";

export interface ConcordProgress {
  stars: Record<string, number>;
  /** Best Mixed run, in correct answers out of 15. */
  mixedBest: number;
}

const empty = (): ConcordProgress => ({ stars: {}, mixedBest: 0 });

function read(): ConcordProgress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<ConcordProgress>;
    return { stars: parsed.stars ?? {}, mixedBest: parsed.mixedBest ?? 0 };
  } catch {
    return empty();
  }
}

function write(progress: ConcordProgress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Not saved this time. The game still works.
  }
}

/** A level is open once the one before it has at least one star. The first is always open. */
export function isUnlocked(progress: ConcordProgress, levelId: string) {
  const index = CONCORD_LEVELS.findIndex((l) => l.id === levelId);
  if (index <= 0) return true;
  return (progress.stars[CONCORD_LEVELS[index - 1].id] ?? 0) >= 1;
}

export function mixedUnlocked(progress: ConcordProgress) {
  return CONCORD_LEVELS.slice(0, 3).every((l) => (progress.stars[l.id] ?? 0) >= 1);
}

function normalize(raw: unknown): ConcordProgress {
  const r = (raw ?? {}) as Partial<ConcordProgress>;
  return { stars: r.stars && typeof r.stars === "object" ? r.stars : {}, mixedBest: Number(r.mixedBest) || 0 };
}

/** Keeps the higher stars per level and the higher Mixed score. */
function merge(a: ConcordProgress, b: ConcordProgress): ConcordProgress {
  const stars = { ...a.stars };
  for (const [id, n] of Object.entries(b.stars)) stars[id] = Math.max(stars[id] ?? 0, n);
  return { stars, mixedBest: Math.max(a.mixedBest, b.mixedBest) };
}

const canon = (p: ConcordProgress) => JSON.stringify([Object.entries(p.stars).sort(), p.mixedBest]);
const same = (a: ConcordProgress, b: ConcordProgress) => canon(a) === canon(b);

async function saveRemote(progress: ConcordProgress) {
  try {
    await supabase().rpc("save_game_progress", { p_game: "concord", p_data: progress });
  } catch {
    // Offline: the device copy is kept, and the next visit saves it.
  }
}

export function useConcordProgress() {
  const { hydrated, account } = useAppState();
  const signedIn = Boolean(account);
  const [progress, setProgress] = useState<ConcordProgress>(empty);
  const [ready, setReady] = useState(false);
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;

  useEffect(() => {
    // Storage is only readable in the browser, so it loads after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(read());
    setReady(true);
  }, []);

  // Once signed in, combine this device's stars with the ones saved on the account.
  useEffect(() => {
    if (!hydrated || !signedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase().rpc("get_game_progress", { p_game: "concord" });
        if (error || cancelled) return;
        const server = normalize(data);
        const local = read();
        const merged = merge(local, server);
        write(merged);
        setProgress(merged);
        if (!same(merged, server)) await saveRemote(merged);
      } catch {
        // Offline: keep playing with the device copy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, signedIn]);

  const record = useCallback((levelId: string, stars: number, correct: number) => {
    const current = read();
    const next: ConcordProgress =
      levelId === MIXED_ID
        ? { ...current, mixedBest: Math.max(current.mixedBest, correct) }
        : { ...current, stars: { ...current.stars, [levelId]: Math.max(current.stars[levelId] ?? 0, stars) } };
    write(next);
    setProgress(next);
    if (signedInRef.current) void saveRemote(next);
  }, []);

  return { progress, ready, record };
}
