"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { MasteryBadge } from "@/components/games/mastery-badge";
import { TOPICS, masteryOf, type Topic } from "@/lib/games/maths/engine";
import { useQuizProgress } from "@/lib/games/quiz/progress";

export default function MathsWorldPage() {
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/games" className="mb-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden />
        Games
      </Link>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Maths World</h1>
        <p className="mt-0.5 text-muted-foreground">Pick a topic. Each one climbs from filling a gap to solving the whole question.</p>
      </header>
      <ul className="flex flex-col gap-3">
        {TOPICS.map((t) => (
          <li key={t.id}>
            <TopicCard topic={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  const { progress, ready } = useQuizProgress({ id: `maths-${topic.id}` });
  const mastery = masteryOf(progress.stars);
  return (
    <Link
      href={`/games/maths/${topic.id}`}
      className="game-card game-tap flex items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-semibold leading-tight">{topic.name}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{topic.tagline}</span>
        {ready ? <MasteryBadge mastery={mastery} className="mt-2" /> : null}
      </span>
      <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
