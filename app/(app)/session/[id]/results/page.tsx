"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, ChevronRight, ClipboardCheck, Clock, Info, Target, Zap } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Confetti, Meter, Stars, SubjectIcon } from "@/components/game/game-ui";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppState } from "@/lib/app-state";
import { data } from "@/lib/data";
import { MODE_LABEL } from "@/lib/engine/presets";
import { GUEST_FREE_ROUNDS } from "@/lib/game/rules";
import { subjectStyle } from "@/lib/game/subject-style";
import { SUBJECTS } from "@/lib/catalog";
import { UTME_FORMAT } from "@/lib/exam-format";
import type { SessionResult, SessionReward } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEADLINE: Record<SessionReward["stars"], { title: string; sub: string }> = {
  3: { title: "Excellent round!", sub: "You really know this." },
  2: { title: "Great work!", sub: "Review your misses to go further." },
  1: { title: "Good effort!", sub: "Every miss is something new learned." },
  0: { title: "Keep going!", sub: "Read the explanations, then try again." },
};

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec / 60);
  if (h) return `${h}h ${m % 60}m`;
  return m ? `${m}m ${sec % 60}s` : `${sec}s`;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <Results />
    </Suspense>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-4 pt-10" aria-busy="true" aria-label="Loading results">
      <Skeleton className="mx-auto h-20 w-56 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
    </div>
  );
}

function Results() {
  const { id } = useParams<{ id: string }>();
  const { setProgress, progress, isGuest, hydrated } = useAppState();
  const [result, setResult] = useState<SessionResult | null | undefined>(undefined);
  const [reward, setReward] = useState<SessionReward | null>(null);
  const [roundsUsed, setRoundsUsed] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      const r = await data.getResult(id);
      if (cancelled) return;
      setResult(r);
      if (!r) return;
      const recorded = await data.recordResult(r);
      if (cancelled) return;
      setReward(recorded.reward);
      setProgress(recorded.progress);
      setRoundsUsed(await data.guestRoundsUsed());
    })();
    return () => {
      cancelled = true;
    };
    // setProgress is stable in behaviour; re-running would only re-read the same reward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hydrated]);

  if (result === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold">No results here yet</h1>
        <p className="mt-2 text-muted-foreground">This session hasn&apos;t been submitted.</p>
        <Link href="/practice" className={buttonVariants({ size: "xl", className: "mt-6 w-full" })}>
          Back to Practice
        </Link>
      </main>
    );
  }

  if (!result || !reward) return <ResultsSkeleton />;

  const isMock = result.config.mode === "mock";
  const subject = result.config.subjectIds[0];
  const practiceAgainHref = {
    quick_five: `/start?last=${subject}`,
    subject: `/practice/subject?s=${subject}`,
    timed: "/practice/timed",
    mock: "/practice/mock",
  }[result.config.mode];
  const roundsLeft = Math.max(0, GUEST_FREE_ROUNDS - roundsUsed);
  const canPracticeAgain = !isGuest || roundsLeft > 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-10 pt-6">
      {isMock ? (
        <MockSummary result={result} />
      ) : (
        <section aria-labelledby="result-title" className="text-center">
          {reward.stars >= 2 ? <Confetti /> : null}
          <p className="font-display text-sm font-semibold text-muted-foreground">{MODE_LABEL[result.config.mode]}</p>
          <Stars count={reward.stars} className="mt-3" />
          <h1 id="result-title" className="mt-3 text-3xl font-semibold">
            {HEADLINE[reward.stars].title}
          </h1>
          <p className="mt-0.5 text-muted-foreground">{HEADLINE[reward.stars].sub}</p>
        </section>
      )}

      <section aria-label="Session stats" className="mt-5 grid grid-cols-3 gap-2.5">
        <StatTile
          icon={<Zap className="size-5 fill-gold text-gold-edge" aria-hidden />}
          value={`+${reward.xpGained}`}
          label="XP earned"
          className="bg-gold-soft"
        />
        <StatTile
          icon={<Target className="size-5 text-primary" aria-hidden />}
          value={`${result.correct}/${result.total}`}
          label={`${result.accuracy}% correct`}
          className="bg-secondary"
        />
        <StatTile
          icon={<Clock className="size-5 text-sky" aria-hidden />}
          value={formatDuration(result.durationSec)}
          label="Time"
          className="bg-sky-soft"
        />
      </section>

      {isGuest ? (
        <section className="mt-3 rounded-2xl border-2 border-b-[5px] border-gold-edge bg-gold-soft p-4">
          <p className="font-display text-lg font-semibold text-gold-ink">
            {roundsLeft > 0 ? "Save your progress" : "Create an account to continue"}
          </p>
          <p className="mt-0.5 text-sm text-gold-ink">
            {roundsLeft > 0
              ? `Keep your ${progress.xp} XP, choose your subjects and set your target scores. ${roundsLeft} free round left.`
              : `You've used your free rounds. It's free, and your ${progress.xp} XP comes with you.`}
          </p>
          <Link href="/register" className={buttonVariants({ variant: "gold", size: "lg", className: "mt-3 w-full" })}>
            Create free account
          </Link>
        </section>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {canPracticeAgain ? (
          <Link href={practiceAgainHref} className={buttonVariants({ size: "xl", className: "w-full" })}>
            Practice again
            <ArrowRight aria-hidden />
          </Link>
        ) : null}
        <Link href={`/session/${id}/review`} className={buttonVariants({ variant: "outline", size: "xl", className: "w-full" })}>
          <ClipboardCheck aria-hidden />
          Review answers
        </Link>
        {!isGuest ? (
          <Link href="/practice" className="py-2 text-center font-display font-semibold text-muted-foreground hover:text-foreground">
            Done
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function StatTile({ icon, value, label, className }: { icon: React.ReactNode; value: string; label: string; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl px-1.5 py-3 text-center sm:px-3", className)}>
      <span className="mx-auto grid place-items-center">{icon}</span>
      <p className="mt-1 font-display text-lg font-semibold leading-tight sm:text-xl">{value}</p>
      <p className="text-xs leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function MockSummary({ result }: { result: SessionResult }) {
  return (
    <section aria-labelledby="result-title">
      <div className="rounded-3xl bg-brand-deep p-5 text-center text-white">
        <p className="font-display text-sm font-semibold text-white/75">Mock Exam result</p>
        <h1 id="result-title" className="mt-1 text-5xl font-semibold">
          {result.utmeScore}
          <span className="text-xl font-medium text-white/70"> / {UTME_FORMAT.maxTotal}</span>
        </h1>
      </div>
      <ul className="game-card mt-3 space-y-1 p-4" aria-label="Score by subject">
        {result.bySubject.map((s) => {
          const subject = SUBJECTS.find((x) => x.id === s.subjectId);
          return (
            <li key={s.subjectId}>
              <Link
                href={`/session/${result.sessionId}/review?s=${s.subjectId}`}
                aria-label={`Review ${subject?.name}, ${s.scaledScore} out of 100`}
                className="-mx-2 flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <SubjectIcon id={s.subjectId} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="min-w-0 font-semibold leading-tight">{subject?.name}</span>
                    <span className="shrink-0 font-display font-semibold">{s.scaledScore}/100</span>
                  </div>
                  <Meter
                    percent={s.scaledScore ?? 0}
                    label={`${subject?.name} score`}
                    className="mt-1 h-2"
                    color={subjectStyle(s.subjectId).color}
                  />
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex gap-2 rounded-xl bg-warning-soft p-3 text-sm text-gold-ink">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>This is a practice simulation. Your mock score is not a prediction of your actual UTME result.</span>
      </p>
    </section>
  );
}
