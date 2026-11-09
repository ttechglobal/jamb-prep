"use client";

import { ArrowLeft, PenLine } from "lucide-react";
import Link from "next/link";
import { CONCORD_LEVELS } from "@/lib/games/concord/levels";
import { useConcordProgress } from "@/lib/games/concord/progress";

export default function GamesPage() {
  const { progress, ready } = useConcordProgress();
  const cleared = CONCORD_LEVELS.filter((l) => (progress.stars[l.id] ?? 0) >= 1).length;

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/practice" className="mb-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden />
        Back to practice
      </Link>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Games</h1>
        <p className="mt-0.5 text-muted-foreground">Learn by playing.</p>
      </header>
      <Link
        href="/games/concord"
        className="game-card game-tap flex items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sky-soft text-sky">
          <PenLine className="size-7" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl font-semibold leading-tight">Concord</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            English: is or are? has or have? Drag the right word in.
            {ready && cleared > 0 ? ` ${cleared}/${CONCORD_LEVELS.length} levels cleared.` : ""}
          </span>
        </span>
      </Link>
    </div>
  );
}
