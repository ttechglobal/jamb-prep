"use client";

import Link from "next/link";
import { Coffee, Timer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { dayKey, formatMinutes } from "@/lib/study/focus-log";
import { clock, useStudyTimer } from "@/lib/study/session";
import { cn } from "@/lib/utils";

/** Home's door to the study hub: start a session, or see the one that is running. */
export function StudyCard({ className }: { className?: string }) {
  const t = useStudyTimer();
  if (!t.ready) return null;

  const today = t.log[dayKey()] ?? 0;
  const live = t.phase !== "idle";
  const Icon = t.phase === "break" ? Coffee : Timer;

  return (
    <Link href="/study" className={cn("game-card game-tap flex items-center gap-3 p-4", className)}>
      <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", t.phase === "break" ? "bg-sky-soft text-sky" : "bg-secondary text-primary")}>
        <Icon className="size-6" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg leading-tight font-semibold">
          {live ? (t.finished ? "Time's up" : t.phase === "break" ? "On a break" : "Studying now") : "Study session"}
        </span>
        <span className="block text-sm text-muted-foreground">
          {live
            ? t.finished
              ? "Tap to choose what is next"
              : `${clock(t.left)} left`
            : today > 0
              ? `${formatMinutes(today)} focused today. Go again?`
              : "Focus in timed blocks with breaks"}
        </span>
      </span>
      <span className={buttonVariants({ variant: live ? "gold" : "outline", size: "lg" })}>{live ? "Open" : "Start"}</span>
    </Link>
  );
}
