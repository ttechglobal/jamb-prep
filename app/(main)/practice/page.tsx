"use client";

import Link from "next/link";
import { BookOpen, BookOpenCheck, ChevronRight, Clock, Gamepad2, Loader2, Target, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import { LevelBar, SubjectIcon } from "@/components/game/game-ui";
import { PartnerCard } from "@/components/partners/partner-card";
import { PathCard } from "@/components/path/path-card";
import { QuickFiveCard } from "@/components/practice/quick-five-card";
import { WorkOnThis } from "@/components/practice/work-on-this";
import { StudyTimesPrompt } from "@/components/study/study-times";
import { Button } from "@/components/ui/button";
import { useStartSession } from "@/hooks/use-start-session";
import { useAppState } from "@/lib/app-state";
import { quickFive } from "@/lib/engine/presets";
import { SUBJECTS } from "@/lib/catalog";
import { UTME_FORMAT } from "@/lib/exam-format";
import { PARTNERS_VISIBLE, PATH_ENABLED } from "@/lib/path/flag";
import { totalTarget } from "@/lib/profile";
import { cn } from "@/lib/utils";

/**
 * Home. A phone gets one column: level and goal, the path, then a grid of small mode cards (Quick Five is one of
 * them). A desktop gets two: the path, Quick Five and the modes on the left, and level, goal and extras on the right.
 */
export default function PracticePage() {
  const { profile, progress } = useAppState();

  if (!profile) return null;

  const firstName = profile.displayName.trim().split(/\s+/)[0];

  return (
    <div>
      <header className="mb-4 lg:mb-6">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Welcome, {firstName}!</h1>
        <p className="mt-0.5 text-muted-foreground">Ready to practice today?</p>
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        {/* Phone: level and goal first. Desktop: they move to the right-hand column. */}
        <aside aria-label="Your progress" className="flex flex-col gap-4 lg:order-2">
          <section className="game-card p-4">
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

          {/* Desktop only: these sit under the level card. On a phone they live elsewhere (profile, bottom bar, below). */}
          <div className="hidden flex-col gap-4 lg:flex">
            <WorkOnThis />
            <ModeCard href="/games" icon={Gamepad2} tint="bg-gold-soft text-gold-ink" title="Games" description="Practise by playing" row />
            <StudyTimesPrompt />
          </div>
        </aside>

        <div className="flex flex-col gap-4 lg:order-1">
          <PathCard />

          {/* Desktop: the big Quick Five block. */}
          <QuickFiveBlock className="hidden lg:block" />

          {PARTNERS_VISIBLE ? <PartnerCard /> : null}

          <section aria-label="More practice" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <QuickFiveCard subjectIds={profile.subjectIds} className="lg:hidden" />
            {/* Notes are read from the study path. Read only gets its own card while the path is switched off. */}
            {PATH_ENABLED ? null : <ModeCard href="/read" icon={BookOpen} tint="bg-sky-soft text-sky" title="Read" description="Notes by topic" className="hidden lg:flex" />}
            <ModeCard
              href="/practice/subject"
              icon={BookOpenCheck}
              tint="bg-sky-soft text-sky"
              title="Subject Practice"
              description="Pick a subject and topic"
            />
            <ModeCard href="/practice/timed" icon={Clock} tint="bg-flame-soft text-flame" title="Timed Practice" description="Beat the clock" />
            <ModeCard href="/practice/mock" icon={Trophy} tint="bg-violet-soft text-violet" title="Mock Exam" description="Full UTME CBT, 2 hours" />
          </section>

          <div className="lg:hidden">
            <StudyTimesPrompt />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The large green Quick Five block with a button for each subject. Desktop only: a phone has the small card. */
function QuickFiveBlock({ className }: { className?: string }) {
  const { profile } = useAppState();
  const { start, starting } = useStartSession();
  const [chosen, setChosen] = useState<string | null>(null);
  if (!profile) return null;

  return (
    <section
      aria-labelledby="quick-five-title"
      className={cn("rounded-3xl border-b-[6px] border-primary-edge bg-primary p-7 text-primary-foreground", className)}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold text-gold-ink">
          <Zap className="size-6 fill-gold text-gold-edge" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h2 id="quick-five-title" className="text-4xl font-semibold leading-tight">
            Quick Five
          </h2>
          <p className="mt-0.5 text-[0.95rem] leading-snug text-primary-foreground/85">Five questions. Pick a subject to start.</p>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-4 gap-2.5">
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
  );
}

function ModeCard({
  href,
  icon: Icon,
  tint,
  title,
  description,
  className,
  row,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tint: string;
  title: string;
  description: string;
  className?: string;
  /** A wide, one-line card for the side column. */
  row?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "game-card game-tap group flex p-4 text-left",
        row ? "items-center gap-3" : "min-h-30 flex-col",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tint)}>
        <Icon className="size-5" strokeWidth={2.4} />
      </span>
      <span className={row ? "min-w-0" : "contents"}>
        <span className={cn("block font-display text-[1.05rem] font-semibold leading-tight", !row && "mt-auto pt-3")}>{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}
