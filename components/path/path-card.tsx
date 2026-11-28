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

  if (overview.mode !== "path" || !current?.next) {
    return (
      <section aria-label="Your path" className={cn("game-card flex items-center gap-3 border-violet/30 bg-violet-soft/40 p-4", className)}>
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-soft text-violet">
          <Route className="size-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-tight">Your path</p>
          <p className="text-sm text-muted-foreground">
            {overview.mode === "practice" ? "Start whenever you like. Your practice already counts." : "Go topic by topic and earn stars."}
          </p>
        </div>
        <Link href="/path" className={buttonVariants({ variant: "outline", size: "lg" })}>
          See it
        </Link>
      </section>
    );
  }

  const subject = SUBJECTS.find((s) => s.id === current.subjectId);
  return (
    <section aria-label="Your path" className={cn("game-card border-violet/40 bg-violet-soft/40 p-4", className)}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-full border-b-[5px] border-[#4C1D95] bg-violet text-white shadow-[0_0_0_5px_#DDD6FE]"
        >
          <Play className="ml-0.5 size-6 fill-current" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-xs font-semibold tracking-wide text-violet">
            <SubjectIcon id={current.subjectId} className="size-5 rounded-md" iconClassName="size-3" />
            YOUR PATH · {subject?.shortName.toUpperCase()}
          </p>
          <p className="line-clamp-2 font-display text-2xl leading-tight font-semibold">{current.next.name}</p>
          <p className="text-xs text-muted-foreground">
            Topic {current.next.index} of {current.unitCount}
          </p>
        </div>
      </div>
      <TrailDots trail={current.trail} nextIndex={current.next.index} />
      <Link
        href={`/path?s=${current.subjectId}&open=${current.next.id}`}
        className={buttonVariants({ variant: "gold", size: "xl", className: "mt-3 w-full" })}
      >
        Continue
      </Link>
    </section>
  );
}

/** A preview of the whole trail: one dot per topic. Gold is solid, green has stars, orange needs a revisit, purple is next. */
function TrailDots({ trail, nextIndex }: { trail: PathOverviewSubject["trail"]; nextIndex: number }) {
  return (
    <ol aria-label="Your trail" className="mt-3.5 flex flex-wrap items-center gap-1.5">
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
