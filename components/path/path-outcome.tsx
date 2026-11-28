"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { useEffect } from "react";
import { StarPips } from "@/components/path/path-node";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { PATH_ENABLED } from "@/lib/path/flag";
import type { PathReward } from "@/lib/path/types";

const NOTE: Record<number, string> = {
  0: "Not yet. Read the explanations, then try this topic again. Moving on is always fine.",
  1: "First star earned. Come back on another day and stay at 70% or more for the second.",
  2: "Second star earned. A week from now, a strong round makes it Solid.",
  3: "Solid. This topic is locked in for now. It will come back in mixed checks.",
};

/** What a finished round did to the path: the topic's stars, or a mixed check. Renders nothing off the path. */
export function PathOutcome({ path, subjectId }: { path: PathReward | undefined; subjectId: string }) {
  const gained = path?.units.filter((u) => u.starsAfter > u.starsBefore).length ?? 0;
  useEffect(() => {
    if (gained > 0) void track("path_star_earned", { subject: subjectId, count: gained });
  }, [gained, subjectId]);

  if (!PATH_ENABLED || !path) return null;

  if (path.checkpoint) {
    return (
      <section aria-label="Mixed check" className="game-card mt-3 flex items-start gap-3 border-violet/40 bg-violet-soft/40 p-4">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-soft text-violet">
          <Trophy className="size-6" />
        </span>
        <div>
          <p className="font-display text-lg font-semibold leading-tight">Mixed check done</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {gained > 0
              ? `${gained} ${gained === 1 ? "topic" : "topics"} moved up a star from these answers.`
              : "These answers count toward all five topics. Stars move up as you practise them on other days."}
          </p>
        </div>
      </section>
    );
  }

  if (path.starsAfter === null || path.starsBefore === null) return null;
  const earned = path.starsAfter > path.starsBefore;
  return (
    <section aria-label="Topic stars" className="game-card mt-3 border-gold-edge/40 bg-gold-soft/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg font-semibold leading-tight">{earned ? "Star earned!" : "Topic stars"}</p>
        <StarPips count={path.starsAfter} className="[&_svg]:size-6" />
      </div>
      <p className="mt-1.5 text-sm text-gold-ink">{NOTE[path.starsAfter]}</p>
      <Link href={`/path?s=${subjectId}`} className={buttonVariants({ variant: "outline", size: "lg", className: "mt-3 w-full" })}>
        Back to my path
      </Link>
    </section>
  );
}
