import Link from "next/link";
import { BookOpenCheck, Check, Clock, Trophy, Zap } from "lucide-react";
import { TrackView } from "@/components/analytics/track-view";
import { Logo } from "@/components/brand/logo";
import { Meter } from "@/components/game/game-ui";
import { StartPractisingButton } from "@/components/landing/start-practising-button";
import { InstallButton } from "@/components/pwa/install-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MODES = [
  { icon: Zap, label: "Quick Five", hint: "5 questions, instantly", tint: "bg-gold-soft text-gold-ink" },
  { icon: BookOpenCheck, label: "Topic Practice", hint: "Drill weak topics", tint: "bg-sky-soft text-sky" },
  { icon: Clock, label: "Timed Practice", hint: "Beat the clock", tint: "bg-flame-soft text-flame" },
  { icon: Trophy, label: "Mock Exam", hint: "Full UTME CBT", tint: "bg-violet-soft text-violet" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TrackView name="landing_view" />
      <div className="bg-brand-deep text-white">
        <header className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
          <Logo tone="light" />
          <Link
            href="/login"
            className="ml-auto inline-flex h-11 items-center rounded-xl px-3 font-display font-semibold text-white hover:bg-white/10"
          >
            Sign in
          </Link>
        </header>

        <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 pb-12 pt-6 sm:pt-10 lg:grid-cols-[1fr_22rem] lg:pb-16">
          <div>
            <p className="font-display text-sm font-semibold tracking-wide text-gold">For JAMB UTME candidates</p>
            <h1 className="mt-2 text-[2.6rem] font-semibold leading-[1.05] text-balance sm:text-6xl">
              Level up for your UTME
            </h1>
            <p className="mt-4 max-w-md text-lg leading-snug text-white/80 text-pretty">
              Quick rounds, instant explanations and full CBT mocks. Earn XP and keep your streak going.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <StartPractisingButton />
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "xl" }),
                  "w-full border-2 border-white/30 text-white hover:bg-white/10 hover:text-white sm:w-auto",
                )}
              >
                Create free account
              </Link>
            </div>
            <p className="mt-3 text-sm text-white/70">No sign-up needed to start.</p>
            <InstallButton className="mt-3" />
          </div>

          <HeroPreview />
        </section>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Practice modes">
          {MODES.map(({ icon: Icon, label, hint, tint }) => (
            <li key={label} className="game-card p-4">
              <span className={cn("grid size-10 place-items-center rounded-xl", tint)}>
                <Icon className="size-5" strokeWidth={2.4} aria-hidden />
              </span>
              <p className="mt-3 font-display font-semibold leading-tight">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-muted-foreground">
        JAMB Prep is an independent practice tool by Exam Prep A1 and is not affiliated with JAMB.
      </footer>
    </div>
  );
}

/** A static glimpse of a round, so the game idea lands without any explanation. */
function HeroPreview() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-xs rotate-1 rounded-3xl border-b-[6px] border-black/25 bg-white p-4 text-foreground lg:max-w-none">
      <div className="flex items-center gap-2">
        <Meter percent={60} label="Round progress" className="flex-1" barClassName="bg-brand-bright" />
        <span className="font-display text-sm font-semibold">3/5</span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-snug">
        Choose the option nearest in meaning: The manager was CANDID about the losses.
      </p>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center gap-2.5 rounded-xl border-2 border-b-4 p-2">
          <span className="grid size-7 place-items-center rounded-lg bg-muted text-xs font-bold">A</span> secretive
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border-2 border-b-4 border-success bg-success-soft p-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-success text-white">
            <Check className="size-4" strokeWidth={3} />
          </span>
          frank
          <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-gold px-2 py-0.5 font-display text-xs text-gold-ink">
            +2 XP
          </span>
        </div>
      </div>
    </div>
  );
}
