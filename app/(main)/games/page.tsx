"use client";

import { ArrowLeft, ArrowLeftRight, AudioLines, Ear, Link2, PenLine, Puzzle, Search, Swords, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { CONCORD_LEVELS } from "@/lib/games/concord/levels";
import { useConcordProgress } from "@/lib/games/concord/progress";
import { QUIZ_GAMES } from "@/lib/games/quiz/games";

const TINT: Record<string, string> = {
  sky: "bg-sky-soft text-sky",
  violet: "bg-violet-soft text-violet",
  primary: "bg-secondary text-primary",
  coral: "bg-flame-soft text-flame",
  gold: "bg-gold-soft text-gold-ink",
};

const ICON: Record<string, LucideIcon> = {
  "grammar-quest": Swords,
  "meaning-match": Link2,
  "opposite-hunt": ArrowLeftRight,
  "sound-detective": Ear,
  "stress-master": AudioLines,
  "idiom-decoder": Puzzle,
  "context-clues": Search,
};

export default function GamesPage() {
  const { progress, ready } = useConcordProgress();
  const cleared = CONCORD_LEVELS.filter((l) => (progress.stars[l.id] ?? 0) >= 1).length;
  const card = "game-card game-tap flex items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/practice" className="mb-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden />
        Back to practice
      </Link>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Games</h1>
        <p className="mt-0.5 text-muted-foreground">English, learnt by playing.</p>
      </header>
      <ul className="flex flex-col gap-3">
        <li>
          <Link href="/games/concord" className={card}>
            <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sky-soft text-sky">
              <PenLine className="size-7" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xl font-semibold leading-tight">Concord</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Is or are? Has or have? Drag the right word in.
                {ready && cleared > 0 ? ` ${cleared}/${CONCORD_LEVELS.length} levels cleared.` : ""}
              </span>
            </span>
          </Link>
        </li>
        {QUIZ_GAMES.map((g) => {
          const Icon = ICON[g.id] ?? Puzzle;
          return (
            <li key={g.id}>
              <Link href={`/games/play/${g.id}`} className={card}>
                <span aria-hidden className={`grid size-14 shrink-0 place-items-center rounded-2xl ${TINT[g.colour] ?? TINT.primary}`}>
                  <Icon className="size-7" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl font-semibold leading-tight">{g.name}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{g.tagline}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
