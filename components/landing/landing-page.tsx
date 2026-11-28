import Link from "next/link";
import { BookOpen, Check, Flame, Gamepad2, Route, Trophy, Zap, type LucideIcon } from "lucide-react";
import { TrackView } from "@/components/analytics/track-view";
import { Logo } from "@/components/brand/logo";
import { Meter } from "@/components/game/game-ui";
import { LaunchVideo } from "@/components/landing/launch-video";
import { StartPractisingButton } from "@/components/landing/start-practising-button";
import { InstallButton } from "@/components/pwa/install-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES: { icon: LucideIcon; title: string; text: string; tint: string; card?: string }[] = [
  {
    icon: Route,
    title: "Follow a path",
    text: "Topic by topic in every subject. Earn stars and always see what is next.",
    tint: "bg-violet-soft text-violet",
    card: "border-violet/30 bg-violet-soft/40",
  },
  { icon: Zap, title: "Quick Five", text: "Five questions, an explanation after each. Done in two minutes.", tint: "bg-gold-soft text-gold-ink" },
  { icon: Trophy, title: "Full CBT mocks", text: "Four subjects, two hours, the way JAMB sets it.", tint: "bg-violet-soft text-violet" },
  { icon: BookOpen, title: "Read the topic", text: "Short notes with key points and common traps.", tint: "bg-sky-soft text-sky" },
  { icon: Gamepad2, title: "Games", text: "Maths World and Concord, where practice feels like play.", tint: "bg-gold-soft text-gold-ink" },
  { icon: Flame, title: "Streaks and XP", text: "A few minutes a day, a weekly leaderboard, visible progress.", tint: "bg-flame-soft text-flame" },
];

const STEPS = [
  { title: "Tap Start practising", text: "No account needed for your first rounds.", node: "bg-violet border-[#4C1D95] text-white" },
  { title: "Pick your subjects", text: "And a target score to aim for.", node: "bg-brand-bright border-primary-edge text-white" },
  { title: "Practise a little each day", text: "Your stars fill in as you go.", node: "bg-gold border-gold-edge text-gold-ink" },
];

/**
 * The page a visitor lands on. `from` is the first name of the ambassador whose link brought them here,
 * so the same page doubles as the referral landing page.
 */
export function LandingPage({ from = null }: { from?: string | null }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TrackView name="landing_view" />

      <div className="bg-brand-deep text-white">
        <header className="mx-auto flex h-14 w-full max-w-5xl items-center px-4 lg:h-16">
          <Logo tone="light" />
          <Link
            href="/login"
            className="ml-auto inline-flex h-11 items-center rounded-xl px-3 font-display font-semibold text-white hover:bg-white/10"
          >
            Sign in
          </Link>
        </header>

        <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 pb-12 pt-4 sm:pt-8 lg:grid-cols-[1fr_22.5rem] lg:gap-16 lg:pb-16">
          <div>
            {from ? (
              <div className="mb-5 flex items-center gap-3 rounded-2xl border-b-[5px] border-gold-edge bg-gold-soft p-3 text-gold-ink">
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-full border-b-4 border-gold-edge bg-gold font-display text-xl font-semibold"
                >
                  {from.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-display text-lg font-semibold leading-tight">{from} invited you</p>
                  <p className="text-sm">to practise for JAMB, free.</p>
                </div>
              </div>
            ) : null}

            <p className="font-display text-sm font-semibold tracking-wide text-gold">For JAMB UTME candidates</p>
            <h1 className="mt-2 text-[2.9rem] font-semibold leading-[1.02] text-balance sm:text-6xl lg:text-7xl">Level up for your UTME</h1>
            <p className="mt-4 max-w-lg text-lg leading-snug text-white/80 text-pretty sm:text-xl">
              Real past questions, explained. Follow a path topic by topic, or just practise. Free to start.
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
                {from ? `Join with ${from}'s invite` : "Create free account"}
              </Link>
            </div>
            <p className="mt-3 text-sm text-white/70 max-sm:text-center">
              {from ? `${from}'s invite stays with you until you sign up.` : "No sign-up needed to start."}
            </p>
            <InstallButton className="mt-2" />
          </div>

          <HeroPreview />
        </section>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        <section aria-labelledby="video-title" className="grid items-center gap-6 py-10 lg:grid-cols-2 lg:gap-14 lg:py-16">
          <div className="lg:order-2">
            <h2 id="video-title" className="text-3xl font-semibold leading-tight lg:text-4xl">
              See it in 30 seconds
            </h2>
            <p className="mt-2 hidden text-lg text-muted-foreground lg:block">
              A quick look at how a round feels, from the first question to your first XP.
            </p>
          </div>
          <LaunchVideo className="lg:order-1" />
        </section>

        <section aria-labelledby="features-title" className="pb-10 lg:pb-16">
          <h2 id="features-title" className="text-3xl font-semibold leading-tight lg:text-center lg:text-4xl">
            Everything in one place
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {FEATURES.map(({ icon: Icon, title, text, tint, card }) => (
              <li key={title} className={cn("game-card flex items-start gap-3.5 p-4 lg:flex-col lg:gap-3 lg:p-5", card)}>
                <span aria-hidden className={cn("grid size-13 shrink-0 place-items-center rounded-2xl", tint)}>
                  <Icon className="size-6.5" strokeWidth={2.2} />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold leading-tight">{title}</h3>
                  <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps-title" className="pb-10 lg:pb-16">
          <h2 id="steps-title" className="text-3xl font-semibold leading-tight lg:text-center lg:text-4xl">
            How it starts
          </h2>
          <ol className="relative mt-6 flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:gap-6">
            <span
              aria-hidden
              className="absolute bottom-9 left-9 top-9 border-l-4 border-dotted border-[#CBD5CE] lg:inset-x-[16%] lg:bottom-auto lg:left-auto lg:top-10 lg:border-l-0 lg:border-t-4"
            />
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex items-center gap-4 lg:flex-col lg:text-center">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-[4.5rem] shrink-0 place-items-center rounded-full border-b-[6px] font-display text-3xl font-semibold",
                    step.node,
                  )}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold leading-tight">{step.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-10 rounded-3xl border-b-[6px] border-primary-edge bg-primary px-5 py-8 text-center text-primary-foreground lg:mb-16 lg:py-10">
          <h2 className="text-3xl font-semibold leading-tight lg:text-4xl">Start free today</h2>
          <p className="mt-1.5 text-primary-foreground/85">Your first rounds need no sign-up.</p>
          <div className="mx-auto mt-5 flex max-w-xs">
            <StartPractisingButton />
          </div>
        </section>
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
    <div aria-hidden className="mx-auto w-full max-w-xs rotate-1 rounded-3xl border-b-[6px] border-black/25 bg-white p-4 text-foreground lg:max-w-none lg:p-5">
      <div className="flex items-center gap-2">
        <Meter percent={60} label="Round progress" className="flex-1" barClassName="bg-brand-bright" />
        <span className="font-display text-sm font-semibold">3/5</span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-snug lg:text-[0.95rem]">
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
