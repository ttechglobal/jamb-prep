"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Display-only countdown derived from the server deadline (never from a client-side counter),
 * so refreshes, sleep/wake and clock drift can't extend the time. The server enforces the deadline.
 */
export function useCountdown(deadlineAt: string | null, onExpire: () => void) {
  const deadline = deadlineAt ? new Date(deadlineAt).getTime() : null;
  const [remainingMs, setRemainingMs] = useState(() => (deadline ? Math.max(0, deadline - Date.now()) : null));
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (deadline === null) return;
    let fired = false;
    const tick = () => {
      const ms = Math.max(0, deadline - Date.now());
      setRemainingMs(ms);
      if (ms === 0 && !fired) {
        fired = true;
        expireRef.current();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [deadline]);

  return remainingMs;
}

export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
