"use client";

import Link from "next/link";
import { Play, Route } from "lucide-react";
import { useEffect, useState } from "react";
import { SubjectIcon } from "@/components/game/game-ui";
import { buttonVariants } from "@/components/ui/button";
import { useAppState } from "@/lib/app-state";
import { SUBJECTS } from "@/lib/catalog";
import { getPathOverview } from "@/lib/path/client";
import { PATH_ENABLED } from "@/lib/path/flag";
import type { PathOverview, PathOverviewSubject } from "@/lib/path/types";
import { cn } from "@/lib/utils";

/**
 * The path's door on Home. A student on the path sees their next topic and a Continue button. A student
 * who chose to just practise (or was never asked) sees a quiet invitation. Practice stays the main thing.
 */
export function PathCard({ className }: { className?: string }) {
  const { profile } = useAppState();
  const [overview, setOverview] = useState<PathOverview | null>(null);

  useEffect(() => {
    if (!PATH_ENABLED) return;
    let live = true;
    getPathOverview()
      .then((o) => live && setOverview(o))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!PATH_ENABLED || !overview || !profile) return null;

  // The subject being worked on comes first (most topics started), then the usual subject order.
  const mine = profile.subjectIds
    .map((id) => overview.subjects.find((s) => s.subjectId === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => b.started - a.started || SUBJECTS.findIndex((s) => s.id === a.subjectId) - SUBJECTS.findIndex((s) => s.id === b.subjectId));
  const current = mine.find((s) => s.next) ?? null;
  if (mine.length === 0) return null;

  // Every student gets the same door. It is never hidden, and a student who chose "Just practise" still sees it.
  if (!current?.next) {
    return (
      <Link
        href="/path"
        aria-label="Your path"
        className={cn("game-card game-tap flex items-center gap-3 border-violet/30 bg-violet-soft/40 p-4", className)}
      >
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-soft text-violet">
          <Route className="size-6" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-semibold leading-tight">Your path</span>
          <span className="block text-sm text-muted-foreground">Every topic is solid. Revisit any of them.</span>
        </span>
        <span className={buttonVariants({ variant: "outline", size: "lg" })}>See it</span>
      </Link>
    );
  }

  const subject = SUBJECTS.find((s) => s.id === current.subjectId);
  // A student who has not answered anything on the path yet is new to it: say where to start.
  const fresh = current.started === 0;
  return (
    <Link
      href={`/path?s=${current.subjectId}&open=${current.next.id}`}
      aria-label={`${fresh ? "Start" : "Continue"} your path: ${current.next.name}`}
      className={cn("game-card game-tap block border-violet/40 bg-violet-soft/40 p-4 lg:flex lg:items-center lg:gap-5 lg:p-5", className)}
    >
      <span className="flex items-center gap-3 lg:min-w-0 lg:flex-1 lg:gap-5">
        <span
          aria-hidden
          className="grid size-14 lg:size-16 shrink-0 place-items-center rounded-full border-b-[5px] border-[#4C1D95] bg-violet text-white shadow-[0_0_0_5px_#DDD6FE]"
        >
          <Play className="ml-0.5 size-6 fill-current" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-display text-xs font-semibold tracking-wide text-violet">
            <SubjectIcon id={current.subjectId} className="size-5 rounded-md" iconClassName="size-3" />
            {fresh ? "START YOUR PATH" : "YOUR PATH"} · {subject?.shortName.toUpperCase()}
          </span>
          <span className="line-clamp-2 font-display text-2xl leading-tight font-semibold">{current.next.name}</span>
          <span className="block text-xs text-muted-foreground">
            {fresh ? `${current.unitCount} topics, most asked first` : `Topic ${current.next.index} of ${current.unitCount}`}
          </span>
          <TrailDots trail={current.trail} nextIndex={current.next.index} className="mt-2 hidden lg:flex" />
        </span>
      </span>
      <TrailDots trail={current.trail} nextIndex={current.next.index} className="lg:hidden" />
      <span className={buttonVariants({ variant: "gold", size: "xl", className: "mt-3 w-full lg:mt-0 lg:w-48 lg:shrink-0" })}>{fresh ? "Start here" : "Continue"}</span>
    </Link>
  );
}

/** A preview of the whole trail: one dot per topic. Gold is solid, green has stars, orange needs a revisit, purple is next. */
function TrailDots({ trail, nextIndex, className }: { trail: PathOverviewSubject["trail"]; nextIndex: number; className?: string }) {
  return (
    <ol aria-label="Your trail" className={cn("mt-3.5 flex flex-wrap items-center gap-1.5", className)}>
      {trail.map((t, i) => {
        const isNext = i + 1 === nextIndex;
        const label = isNext ? "Next up" : t.revisit ? "Revisit" : t.stars === 0 ? "Not started" : `${t.stars} of 3 stars`;
        return (
          <li
            key={i}
            title={label}
            className={cn(
              "shrink-0 rounded-full",
              isNext
                ? "size-6 border-4 border-[#DDD6FE] bg-violet"
                : cn(
                    "size-3.5",
                    t.revisit ? "bg-[#FB923C]" : t.stars >= 3 ? "bg-gold" : t.stars > 0 ? "bg-brand-bright" : "bg-border",
                  ),
            )}
          >
            <span className="sr-only">{`Topic ${i + 1}: ${label}`}</span>
          </li>
        );
      })}
    </ol>
  );
}
