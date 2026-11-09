"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2, Trophy, Zap } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { SubjectIcon } from "@/components/game/game-ui";
import { buttonVariants } from "@/components/ui/button";
import { useStartSession } from "@/hooks/use-start-session";
import { TrackView } from "@/components/analytics/track-view";
import { useAppState } from "@/lib/app-state";
import { data } from "@/lib/data";
import { quickFive } from "@/lib/engine/presets";
import { GUEST_FREE_ROUNDS } from "@/lib/game/rules";
import { SUBJECTS } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export default function StartPage() {
  return (
    <Suspense>
      <SubjectPicker />
    </Suspense>
  );
}

/** One tap on a subject starts five questions. Also where "Practice again" lands. */
function SubjectPicker() {
  const last = useSearchParams().get("last");
  const { hydrated, account, profile, progress } = useAppState();
  const { start, starting } = useStartSession();
  const [chosen, setChosen] = useState<string | null>(null);
  const [roundsUsed, setRoundsUsed] = useState<number | null>(null);

  useEffect(() => {
    data.guestRoundsUsed().then(setRoundsUsed);
  }, []);

  const subjects = useMemo(() => {
    const mine = profile ? SUBJECTS.filter((s) => profile.subjectIds.includes(s.id)) : SUBJECTS;
    return [...mine].sort((a, b) => Number(b.id === last) - Number(a.id === last));
  }, [last, profile]);

  const active = starting ? chosen : null;

  if (!hydrated || roundsUsed === null) return <div className="min-h-dvh" aria-busy="true" />;

  if (!account && roundsUsed >= GUEST_FREE_ROUNDS) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-8 text-center">
        <TrackView name="free_limit_reached" />
        <Logo className="mx-auto" />
        <span className="mx-auto mt-8 grid size-16 place-items-center rounded-2xl bg-gold-soft text-gold-edge">
          <Trophy className="size-8" strokeWidth={2.4} aria-hidden />
        </span>
        <h1 className="mt-4 text-3xl font-semibold leading-tight">Nice practice!</h1>
        <p className="mt-2 text-muted-foreground">
          You&apos;ve used your {GUEST_FREE_ROUNDS} free rounds. Create a free account to keep going
          {progress.xp > 0 ? ` and save your ${progress.xp} XP` : ""}.
        </p>
        <Link href="/register" className={buttonVariants({ size: "xl", className: "mt-6 w-full" })}>
          Create free account
        </Link>
        <Link href="/login" className="mt-2 inline-block py-2.5 text-sm font-semibold text-primary hover:underline">
          I already have an account
        </Link>
      </main>
    );
  }

  const left = GUEST_FREE_ROUNDS - roundsUsed;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-8">
      <header className="flex h-15 items-center gap-1">
        <Link
          href={account ? "/practice" : "/"}
          aria-label="Back"
          className={buttonVariants({ variant: "ghost", size: "icon-lg", className: "-ml-2" })}
        >
          <ArrowLeft aria-hidden className="size-5!" />
        </Link>
        <Logo href={account ? "/practice" : "/"} />
      </header>

      <main className="flex-1 pt-3">
        <p className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 font-display text-sm font-semibold text-gold-ink">
          <Zap className="size-3.5 fill-current" aria-hidden /> 5 quick questions
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Pick a subject</h1>
        <p className="mt-1 text-muted-foreground">
          {account
            ? "Tap one to start."
            : `${left} free round${left === 1 ? "" : "s"} left. No account needed.`}
        </p>

        <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {subjects.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={starting}
                onClick={() => {
                  setChosen(s.id);
                  start(quickFive([s.id]));
                }}
                className={cn(
                  "game-card game-tap flex min-h-16 w-full items-center gap-3 px-3 text-left",
                  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active && active !== s.id && "opacity-50",
                  active === s.id && "border-primary bg-secondary",
                )}
              >
                <SubjectIcon id={s.id} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[1.05rem] font-semibold leading-tight">{s.name}</span>
                  {s.id === last ? <span className="block text-xs text-muted-foreground">Last played</span> : null}
                </span>
                {active === s.id ? (
                  <Loader2 className="size-5 animate-spin text-primary" aria-label="Starting" />
                ) : (
                  <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
