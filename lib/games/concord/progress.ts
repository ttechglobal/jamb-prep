"use client";

import { useCallback, useEffect, useState } from "react";
import { CONCORD_LEVELS, MIXED_ID } from "./levels";

/**
 * Stars per level, kept on this device for now (the game is being tested before it gets a database table).
 * Reads and writes never throw, since storage can be blocked in private windows.
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

export function useConcordProgress() {
  const [progress, setProgress] = useState<ConcordProgress>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Storage is only readable in the browser, so it loads after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(read());
    setReady(true);
  }, []);

  const record = useCallback((levelId: string, stars: number, correct: number) => {
    const current = read();
    const next: ConcordProgress =
      levelId === MIXED_ID
        ? { ...current, mixedBest: Math.max(current.mixedBest, correct) }
        : { ...current, stars: { ...current.stars, [levelId]: Math.max(current.stars[levelId] ?? 0, stars) } };
    write(next);
    setProgress(next);
  }, []);

  return { progress, ready, record };
}
