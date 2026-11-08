"use client";

import Link from "next/link";
import { BookOpenCheck, ChevronRight, Clock, Gamepad2, Loader2, Target, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import { LevelBar, SubjectIcon } from "@/components/game/game-ui";
import { Button } from "@/components/ui/button";
import { useStartSession } from "@/hooks/use-start-session";
import { useAppState } from "@/lib/app-state";
import { quickFive } from "@/lib/engine/presets";
import { SUBJECTS } from "@/lib/catalog";
import { UTME_FORMAT } from "@/lib/exam-format";
import { totalTarget } from "@/lib/profile";
import { cn } from "@/lib/utils";

export default function PracticePage() {
  const { profile, progress } = useAppState();
  const { start, starting } = useStartSession();
  const [chosen, setChosen] = useState<string | null>(null);

  if (!profile) return null;

  const firstName = profile.displayName.trim().split(/\s+/)[0];

  return (
    <div>
      <header className="mb-4 lg:mb-6">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Welcome, {firstName}!</h1>
        <p className="mt-0.5 text-muted-foreground">Ready to practice today?</p>
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <section
            aria-labelledby="quick-five-title"
            className="order-2 rounded-3xl border-b-[6px] border-primary-edge bg-primary p-5 text-primary-foreground sm:p-7"
          >
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold text-gold-ink">
                <Zap className="size-6 fill-gold text-gold-edge" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h2 id="quick-five-title" className="text-3xl font-semibold leading-tight sm:text-4xl">
                  Quick Five
                </h2>
                <p className="mt-0.5 text-[0.95rem] leading-snug text-primary-foreground/85">Five questions. Pick a subject to start.</p>
              </div>
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-2.5">
              {profile.subjectIds.map((id) => {
                const subject = SUBJECTS.find((s) => s.id === id);
                const busy = starting && chosen === id;
                return (
                  <li key={id}>
                    <Button
                      variant="white"
                      size="lg"
                      aria-label={`Quick Five in ${subject?.name}`}
                      disabled={starting}
                      onClick={() => {
                        setChosen(id);
                        start(quickFive([id]));
                      }}
                      className="h-14 w-full justify-start gap-2 px-2.5"
                    >
                      <SubjectIcon id={id} className="size-8 rounded-lg" iconClassName="size-4" />
                      <span className="min-w-0 flex-1 truncate text-left text-[0.95rem]">{subject?.shortName}</span>
                      {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="More practice" className="order-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-3">
            <ModeCard
              href="/practice/subject"
              icon={BookOpenCheck}
              tint="bg-sky-soft text-sky"
              title="Subject Practice"
              description="Pick a subject and topic"
            />
            <ModeCard href="/practice/timed" icon={Clock} tint="bg-flame-soft text-flame" title="Timed Practice" description="Beat the clock" />
            <ModeCard
              href="/practice/mock"
              icon={Trophy}
              tint="bg-violet-soft text-violet"
              title="Mock Exam"
              description="Full UTME CBT, 2 hours"
            />
            <ModeCard
              href="/games"
              icon={Gamepad2}
              tint="bg-gold-soft text-gold-ink"
              title="Games"
              description="Drill grammar by playing"
              className="lg:hidden"
            />
          </section>
        </div>

        <div className="order-1 flex flex-col gap-4">
        <section aria-label="Your progress" className="game-card p-4">
          <LevelBar xp={progress.xp} />
          <Link
            href="/settings?edit=targets"
            aria-label={`Your desired JAMB score is ${totalTarget(profile)} out of ${UTME_FORMAT.maxTotal}. Tap to edit.`}
            className="-mx-2 mt-2 flex min-h-12 items-center gap-2 rounded-xl px-2 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Target className="size-5 shrink-0 text-primary" aria-hidden />
            <p className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">Your desired JAMB score</p>
            <p className="shrink-0 font-display text-xl font-semibold leading-none">
              {totalTarget(profile)}
              <span className="text-sm font-medium text-muted-foreground"> / {UTME_FORMAT.maxTotal}</span>
            </p>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </section>
        <ModeCard
          href="/games"
          icon={Gamepad2}
          tint="bg-gold-soft text-gold-ink"
          title="Games"
          description="Drill grammar by playing"
          className="hidden min-h-0 lg:flex"
        />
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  href,
  icon: Icon,
  tint,
  title,
  description,
  className,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tint: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "game-card game-tap group flex min-h-30 flex-col p-4",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className={cn("grid size-10 place-items-center rounded-xl", tint)}>
        <Icon className="size-5" strokeWidth={2.4} />
      </span>
      <p className="mt-auto pt-3 font-display text-[1.05rem] font-semibold leading-tight">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </Link>
  );
}
