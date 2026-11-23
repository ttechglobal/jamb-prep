"use client";

import { ArrowLeft, Lock, Star } from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { MasteryBadge } from "@/components/games/mastery-badge";
import { MATHS_LEVELS, masteryOf, topicById } from "@/lib/games/maths/engine";
import { isUnlocked, useQuizProgress } from "@/lib/games/quiz/progress";
import { cn } from "@/lib/utils";

export default function MathsLevelMapPage() {
  const { topic: topicId } = useParams<{ topic: string }>();
  const topic = topicById(topicId);
  if (!topic) notFound();
  return <LevelMap topicId={topic.id} name={topic.name} tagline={topic.tagline} />;
}

function LevelMap({ topicId, name, tagline }: { topicId: string; name: string; tagline: string }) {
  const { progress, ready } = useQuizProgress({ id: `maths-${topicId}` });
  // The unlock rule only reads the level ids, so it serves Maths World as well.
  const asGame = { levels: MATHS_LEVELS };
  const mastery = masteryOf(progress.stars);
  const base = `/games/maths/${topicId}`;

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/games/maths" className="mb-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden />
        Maths World
      </Link>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{name}</h1>
        <p className="mt-0.5 text-muted-foreground">{tagline}</p>
        {ready ? <MasteryBadge mastery={mastery} className="mt-3" /> : null}
      </header>

      <ol className="flex flex-col gap-3">
        {MATHS_LEVELS.map((level, i) => {
          const stars = progress.stars[level.id] ?? 0;
          const open = isUnlocked(asGame, progress, level.id);
          const inner = (
            <>
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary font-display text-xl font-semibold text-primary">
                {open ? i + 1 : <Lock className="size-5 text-muted-foreground" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-semibold leading-tight">{level.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{level.blurb}</span>
              </span>
              <span className="flex shrink-0" aria-label={`${stars} of 3 stars`}>
                {[1, 2, 3].map((n) => (
                  <Star key={n} className={cn("size-5", n <= stars ? "fill-gold text-gold" : "text-muted")} aria-hidden />
                ))}
              </span>
            </>
          );
          return (
            <li key={level.id}>
              {open ? (
                <Link href={`${base}/${level.id}`} className="game-card game-tap flex items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  {inner}
                </Link>
              ) : (
                <div className="game-card flex items-center gap-3 p-4 opacity-60" aria-disabled>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-center text-sm text-muted-foreground">Get 3 out of 5 right to earn a star and open the next level. Three stars on every level, including Solve it, makes you an expert.</p>
    </div>
  );
}
