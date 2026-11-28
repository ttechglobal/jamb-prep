"use client";

import Link from "next/link";
import { ArrowLeft, Check, Lock, Zap } from "lucide-react";
import { LevelBadge, LevelBar } from "@/components/game/game-ui";
import { useAppState } from "@/lib/app-state";
import { RANKS, XP, levelFor, xpForLevel } from "@/lib/game/rules";
import { READ_XP } from "@/lib/read/xp";
import { cn } from "@/lib/utils";

const EARN = [
  { label: "Each correct answer", xp: XP.correct },
  { label: "Finishing a round", xp: XP.finish },
  { label: "Three stars on a round", xp: XP.threeStars },
  { label: "Finishing a lesson in Read (once each)", xp: READ_XP },
];

/** Levels and ranks: where the student is, the ranks ahead and what each one asks for, and how XP is earned. */
export default function LevelsPage() {
  const { progress } = useAppState();
  const lvl = levelFor(progress.xp);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/practice" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Home
      </Link>

      <header className="mt-1 flex items-center gap-4">
        <LevelBadge level={lvl.level} className="size-20" />
        <div className="min-w-0">
          <p className="font-display text-xs font-semibold tracking-wide text-gold-ink">LEVEL {lvl.level}</p>
          <h1 className="text-3xl leading-tight font-semibold">{lvl.title}</h1>
          <p className="text-sm text-muted-foreground">{progress.xp.toLocaleString("en-NG")} XP so far</p>
        </div>
      </header>

      <section className="game-card mt-4 p-4">
        <LevelBar xp={progress.xp} />
      </section>

      <section aria-labelledby="ranks-title" className="mt-6">
        <h2 id="ranks-title" className="text-xl font-semibold">
          Ranks
        </h2>
        <ol className="mt-2 flex flex-col gap-2">
          {RANKS.map((r, i) => {
            const next = RANKS[i + 1];
            const reached = lvl.level >= r.from;
            const current = reached && (!next || lvl.level < next.from);
            return (
              <li
                key={r.title}
                aria-current={current ? "step" : undefined}
                className={cn("game-card flex items-center gap-3 p-3.5", current && "border-gold bg-gold-soft", !reached && "opacity-75")}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full",
                    current ? "bg-gold text-gold-ink" : reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {reached ? <Check className="size-5" strokeWidth={3} /> : <Lock className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg leading-tight font-semibold">
                    {r.title}
                    {current ? <span className="ml-2 text-xs font-semibold text-gold-ink">YOU ARE HERE</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{next ? `Levels ${r.from} to ${next.from - 1}` : `Level ${r.from} and up`}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  <span className="block font-display text-sm font-semibold text-foreground">{xpForLevel(r.from).toLocaleString("en-NG")} XP</span>
                  {reached ? "reached" : `${(xpForLevel(r.from) - progress.xp).toLocaleString("en-NG")} to go`}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="earn-title" className="mt-6">
        <h2 id="earn-title" className="text-xl font-semibold">
          How you earn XP
        </h2>
        <ul className="game-card mt-2 divide-y-2">
          {EARN.map((e) => (
            <li key={e.label} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 text-sm font-medium">{e.label}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-soft px-2.5 py-0.5 font-display text-sm font-semibold text-gold-ink">
                <Zap className="size-3.5 fill-gold text-gold-edge" aria-hidden />+{e.xp}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">XP shows effort and practice. It is not a prediction of your JAMB score.</p>
      </section>
    </div>
  );
}
