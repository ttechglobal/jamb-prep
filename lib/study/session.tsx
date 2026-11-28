"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addFocus, readLog, type FocusLog } from "./focus-log";

/**
 * The study timer. One session for the whole app, so it keeps running while the student reads, practises or plays.
 *
 * Time is worked out from a finish time, never counted tick by tick, so a locked phone, a throttled tab or a reload
 * cannot make it drift. The state is saved on the device and picked up again on the next visit.
 */
export const FOCUS_CHOICES = [10, 15, 25, 35, 50] as const;
export const BREAK_CHOICES = [5, 10, 15] as const;
/** After this many focus blocks in a session, the suggested break is the long one. */
export const BLOCKS_BEFORE_LONG_BREAK = 4;

export type Phase = "idle" | "focus" | "break";

type Saved = {
  phase: Phase;
  /** Length of the current block in seconds. */
  total: number;
  /** When the block ends (ms), while it runs. */
  endsAt: number | null;
  /** Seconds left, while it is paused. */
  pausedLeft: number | null;
  /** The block reached zero and waits for the student to choose what next. */
  finished: boolean;
  /** Focus blocks finished in this session. */
  blocks: number;
  /** Seconds of the current focus block already in the daily log. */
  credited: number;
  /** The student's last choices, so the next session starts where they left off. */
  focusMin: number;
  breakMin: number;
  /** Focus seconds in this whole session, for the summary. */
  sessionSeconds: number;
};

const KEY = "jp:study-session:v1";
const FRESH: Saved = {
  phase: "idle",
  total: 0,
  endsAt: null,
  pausedLeft: null,
  finished: false,
  blocks: 0,
  credited: 0,
  focusMin: 25,
  breakMin: 5,
  sessionSeconds: 0,
};

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...FRESH, ...(JSON.parse(raw) as Partial<Saved>) } : FRESH;
  } catch {
    return FRESH;
  }
}

export type StudyTimer = {
  ready: boolean;
  phase: Phase;
  /** Whole seconds left in this block. */
  left: number;
  total: number;
  running: boolean;
  paused: boolean;
  finished: boolean;
  blocks: number;
  focusMin: number;
  breakMin: number;
  sessionSeconds: number;
  /** The break offered next: long after every fourth block. */
  suggestedBreak: number;
  log: FocusLog;
  keepAwake: boolean;
  setFocusMin(m: number): void;
  setBreakMin(m: number): void;
  setKeepAwake(on: boolean): void;
  start(): void;
  pause(): void;
  resume(): void;
  /** Keeps going: another stretch of focus after a finished block. */
  extend(minutes: number): void;
  startBreak(minutes?: number): void;
  /** Ends a break and begins another focus block. */
  nextFocus(): void;
  /** Ends the whole session. Focus time so far is kept. */
  end(): void;
};

const Ctx = createContext<StudyTimer | null>(null);

/** A short two-note chime made in the browser, so no audio file has to be downloaded. */
function chime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    // No audio on this device: the vibration and the screen still tell the student.
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}

export const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const TITLE_PREFIX = /^(?:⏱|☕|✓) [^·]*· /u;

export function StudyTimerProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<Saved>(FRESH);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [log, setLog] = useState<FocusLog>({});
  const [keepAwake, setKeepAwakeState] = useState(false);

  const sRef = useRef(s);
  useEffect(() => {
    sRef.current = s;
  });
  /** Seconds of the current focus block already logged. A ref, so a repeated effect can never log twice. */
  const credited = useRef(0);
  const finishedFor = useRef<number | null>(null);
  const wake = useRef<WakeLockSentinel | null>(null);

  // Saved state only exists in the browser, so it is read after the first render rather than during it.
  useEffect(() => {
    const saved = load();
    /* eslint-disable react-hooks/set-state-in-effect */
    credited.current = saved.credited;
    setS(saved);
    setLog(readLog());
    setKeepAwakeState(localStorage.getItem("jp:study-awake") === "1");
    setNow(Date.now());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(s));
  }, [s, ready]);

  const running = s.endsAt !== null && !s.finished;
  const left = s.finished ? 0 : s.endsAt !== null ? Math.max(0, Math.ceil((s.endsAt - now) / 1000)) : (s.pausedLeft ?? s.total);

  // Look at the clock twice a second while running, and straight away when the tab comes back.
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);

  /** Moves focus time that has passed in this block into the daily log. */
  const credit = useCallback((leftNow: number) => {
    const st = sRef.current;
    if (st.phase !== "focus") return;
    const done = Math.max(0, st.total - leftNow);
    const delta = done - credited.current;
    if (delta < 1) return;
    credited.current = done;
    setLog(addFocus(delta));
    setS((c) => ({ ...c, credited: done, sessionSeconds: c.sessionSeconds + delta }));
  }, []);

  // Log as time passes, so closing the app mid-block loses at most a few seconds.
  useEffect(() => {
    if (running && s.phase === "focus" && left > 0 && left % 10 === 0) credit(left);
  }, [left, running, s.phase, credit]);

  // The block reached zero.
  useEffect(() => {
    if (!running || left > 0 || s.endsAt === null || finishedFor.current === s.endsAt) return;
    finishedFor.current = s.endsAt;
    credit(0);
    setS((c) => ({ ...c, finished: true, endsAt: null, pausedLeft: 0, blocks: c.phase === "focus" ? c.blocks + 1 : c.blocks }));
    chime();
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(s.phase === "focus" ? "Focus block done" : "Break over", {
          body: s.phase === "focus" ? "Nice work. Take a break or keep going." : "Ready for the next block?",
          icon: "/icons/icon-192.png",
          tag: "jambprep-study-timer",
        });
      } catch {}
    }
  }, [left, running, s.endsAt, s.phase, credit]);

  // The time in the tab title, for a student who has switched to another tab.
  useEffect(() => {
    if (!ready) return;
    const base = document.title.replace(TITLE_PREFIX, "");
    if (s.phase === "idle") {
      document.title = base;
      return;
    }
    document.title = s.finished ? `✓ Time's up · ${base}` : `${s.phase === "focus" ? "⏱" : "☕"} ${clock(left)} · ${base}`;
  }, [left, s.phase, s.finished, ready]);

  // Keeps the screen on during a running block, when the student asks for it.
  useEffect(() => {
    if (!(keepAwake && running && "wakeLock" in navigator)) return;
    let gone = false;
    navigator.wakeLock
      .request("screen")
      .then((l) => {
        if (gone) l.release().catch(() => {});
        else wake.current = l;
      })
      .catch(() => {});
    return () => {
      gone = true;
      wake.current?.release().catch(() => {});
      wake.current = null;
    };
  }, [keepAwake, running]);

  const setKeepAwake = useCallback((on: boolean) => {
    setKeepAwakeState(on);
    localStorage.setItem("jp:study-awake", on ? "1" : "0");
  }, []);

  const begin = useCallback((phase: "focus" | "break", minutes: number, patch: Partial<Saved> = {}) => {
    const t = Date.now();
    credited.current = 0;
    setNow(t);
    setS((c) => ({ ...c, ...patch, phase, total: minutes * 60, endsAt: t + minutes * 60_000, pausedLeft: null, finished: false, credited: 0 }));
  }, []);

  const leftNow = () => {
    const st = sRef.current;
    return st.endsAt !== null ? Math.max(0, Math.ceil((st.endsAt - Date.now()) / 1000)) : (st.pausedLeft ?? 0);
  };

  const suggestedBreak = s.blocks > 0 && s.blocks % BLOCKS_BEFORE_LONG_BREAK === 0 ? 15 : s.breakMin;

  const value = useMemo<StudyTimer>(
    () => ({
      ready,
      phase: s.phase,
      left,
      total: s.total,
      running,
      paused: s.phase !== "idle" && !s.finished && s.endsAt === null,
      finished: s.finished,
      blocks: s.blocks,
      focusMin: s.focusMin,
      breakMin: s.breakMin,
      sessionSeconds: s.sessionSeconds,
      suggestedBreak,
      log,
      keepAwake,
      setFocusMin: (m) => setS((c) => ({ ...c, focusMin: m })),
      setBreakMin: (m) => setS((c) => ({ ...c, breakMin: m })),
      setKeepAwake,
      start: () => begin("focus", s.focusMin, { blocks: 0, sessionSeconds: 0 }),
      pause: () => {
        const st = sRef.current;
        if (st.endsAt === null) return;
        const remaining = leftNow();
        credit(remaining);
        setS((c) => ({ ...c, endsAt: null, pausedLeft: remaining }));
      },
      resume: () => {
        const st = sRef.current;
        if (st.pausedLeft === null) return;
        const t = Date.now();
        setNow(t);
        setS((c) => ({ ...c, endsAt: t + (c.pausedLeft ?? 0) * 1000, pausedLeft: null }));
      },
      extend: (minutes) => begin("focus", minutes),
      startBreak: (minutes) => begin("break", minutes ?? suggestedBreak),
      nextFocus: () => begin("focus", s.focusMin),
      end: () => {
        const st = sRef.current;
        if (st.phase === "focus" && !st.finished) credit(leftNow());
        credited.current = 0;
        setS((c) => ({ ...FRESH, focusMin: c.focusMin, breakMin: c.breakMin }));
      },
    }),
    [ready, s, left, running, suggestedBreak, log, keepAwake, setKeepAwake, begin, credit],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudyTimer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudyTimer must be used inside StudyTimerProvider");
  return ctx;
}
