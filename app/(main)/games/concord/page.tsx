"use client";

import { ArrowLeft, Lock, Shuffle, Star } from "lucide-react";
import Link from "next/link";
import { CONCORD_LEVELS, MIXED_ID } from "@/lib/games/concord/levels";
import { isUnlocked, mixedUnlocked, useConcordProgress } from "@/lib/games/concord/progress";
import { cn } from "@/lib/utils";

export default function ConcordMapPage() {
  const { progress, ready } = useConcordProgress();
  const cleared = CONCORD_LEVELS.filter((l) => (progress.stars[l.id] ?? 0) >= 1).length;
  const mixedOpen = mixedUnlocked(progress);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/games" className="mb-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden />
        Games
      </Link>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Concord</h1>
        <p className="mt-0.5 text-muted-foreground">
          Make the verb agree with the subject. {ready ? `${cleared} of ${CONCORD_LEVELS.length} levels cleared.` : ""}
        </p>
      </header>

      <ol className="flex flex-col gap-3">
        {CONCORD_LEVELS.map((level, i) => {
          const stars = progress.stars[level.id] ?? 0;
          const open = isUnlocked(progress, level.id);
          const current = open && stars === 0;
          const inner = (
            <>
              <span
                aria-hidden
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-2xl font-display text-xl font-semibold",
                  !open ? "bg-muted text-muted-foreground" : stars > 0 ? "bg-gold text-gold-ink" : "bg-primary text-primary-foreground",
                )}
              >
                {open ? i + 1 : <Lock className="size-5" />}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-display text-lg font-semibold leading-tight">{level.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{level.question}</span>
              </span>
              <span role="img" aria-label={`${stars} of 3 stars`} className="flex shrink-0 gap-0.5">
                {[0, 1, 2].map((n) => (
                  <Star key={n} aria-hidden className={cn("size-5", n < stars ? "fill-gold text-gold-edge" : "fill-muted text-border")} strokeWidth={1.8} />
                ))}
              </span>
            </>
          );
          const base = "game-card flex items-center gap-3 p-3.5";
          return (
            <li key={level.id}>
              {open ? (
                <Link
                  href={`/games/concord/${level.id}`}
                  className={cn(base, "game-tap focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50", current && "border-primary")}
                >
                  {inner}
                </Link>
              ) : (
                <div aria-disabled className={cn(base, "opacity-60")}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}

        <li>
          {mixedOpen ? (
            <Link
              href={`/games/concord/${MIXED_ID}`}
              className="game-card game-tap flex items-center gap-3 border-violet p-3.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-soft text-violet">
                <Shuffle className="size-5" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-display text-lg font-semibold leading-tight">Mixed</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                  Every rule, shuffled.{progress.mixedBest > 0 ? ` Best: ${progress.mixedBest}/15` : ""}
                </span>
              </span>
            </Link>
          ) : (
            <div aria-disabled className="game-card flex items-center gap-3 p-3.5 opacity-60">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Lock className="size-5" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-display text-lg font-semibold leading-tight">Mixed</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">Clear the first three levels to unlock.</span>
              </span>
            </div>
          )}
        </li>
      </ol>
    </div>
  );
}
