"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee, Pause, Play, Timer } from "lucide-react";
import { isFocusedPage } from "@/lib/games/session-route";
import { clock, useStudyTimer } from "@/lib/study/session";
import { cn } from "@/lib/utils";

/** Pages where a student is signed in and using the app. The landing page and sign-in screens never show the timer. */
const IN_APP = /^\/(practice|path|read|games|leaderboard|settings|progress|session|start|study|partners)(\/|$)/;

/**
 * The running timer, always in reach. It sits above the bottom bar, or under the top bar on pages that take the whole
 * screen (a lesson, a game, a practice round). Tap it to go to the study hub.
 */
export function SessionPill() {
  const pathname = usePathname();
  const t = useStudyTimer();
  if (!t.ready || t.phase === "idle" || !IN_APP.test(pathname) || pathname.startsWith("/study")) return null;

  const full = isFocusedPage(pathname) || pathname.startsWith("/session");
  const Icon = t.phase === "break" ? Coffee : Timer;

  return (
    <div
      className={cn(
        "fixed z-40 flex items-center gap-1 rounded-full border-2 border-b-4 bg-card p-1 shadow-sm",
        t.finished ? "border-gold" : t.phase === "break" ? "border-sky/40" : "border-primary/40",
        full ? "top-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))] right-3" : "right-3 bottom-[5.5rem] sm:bottom-4",
      )}
    >
      <Link
        href="/study"
        aria-label={t.finished ? "Time's up. Open the study timer" : `Study timer, ${clock(t.left)} left. Open it`}
        className="flex h-9 items-center gap-1.5 rounded-full pr-2 pl-3 font-display text-sm font-semibold tabular-nums"
      >
        <Icon className={cn("size-4", t.phase === "break" ? "text-sky" : "text-primary")} aria-hidden />
        {t.finished ? "Time's up" : clock(t.left)}
      </Link>
      {!t.finished ? (
        <button
          type="button"
          onClick={t.running ? t.pause : t.resume}
          aria-label={t.running ? "Pause the timer" : "Resume the timer"}
          className="grid size-9 place-items-center rounded-full bg-muted text-foreground hover:bg-secondary"
        >
          {t.running ? <Pause className="size-4 fill-current" aria-hidden /> : <Play className="size-4 fill-current" aria-hidden />}
        </button>
      ) : null}
    </div>
  );
}
