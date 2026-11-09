"use client";

import { Bell, Flame, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { usePwa } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";

const SEEN = "jp:welcomed";

const SLIDES = [
  {
    icon: Zap,
    tint: "bg-gold-soft text-gold-ink",
    title: "JAMB Prep is on your phone",
    body: "Five questions take about two minutes. Open the app, pick a subject and go.",
  },
  {
    icon: Flame,
    tint: "bg-flame-soft text-flame",
    title: "Practise a little every day",
    body: "Earn XP for every answer and keep your streak going. Small daily rounds beat one long cram.",
  },
  {
    icon: Bell,
    tint: "bg-sky-soft text-sky",
    title: "Get a nudge to practise",
    body: "A short reminder each day, and a warning before your streak ends. Turn it off any time in Profile.",
  },
] as const;

/**
 * Shown once, the first time the installed app is opened from the home screen. It is the app's
 * hello, separate from account setup. The last slide asks for reminders, because the app is now on
 * the device (on iPhone, reminders only work from here).
 */
export function InstalledWelcome() {
  const { standalone, reminders, busy, toggleReminders } = usePwa();
  const { hydrated, account } = useAppState();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Only the installed app, never a browser tab: installing from the website must not trigger it.
    if (!standalone || !hydrated) return;
    try {
      if (localStorage.getItem(SEEN)) return;
    } catch {
      return;
    }
    setOpen(true);
  }, [standalone, hydrated]);

  if (!open) return null;

  // Reminders need an account and a browser that supports them; otherwise the slide is just a hello.
  const slides = account && reminders === "off" ? SLIDES : SLIDES.slice(0, 2);
  const last = step >= slides.length - 1;
  const slide = slides[Math.min(step, slides.length - 1)];
  const Icon = slide.icon;

  function finish() {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      // Shown again next launch at worst.
    }
    setOpen(false);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome to JAMB Prep" className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="mx-auto flex h-14 w-full max-w-xl items-center px-4">
        <Logo />
        {!last ? (
          <button
            type="button"
            onClick={finish}
            className="ml-auto inline-flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Skip
          </button>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
        <span className={cn("grid size-24 place-items-center rounded-3xl", slide.tint)}>
          <Icon className="size-12" strokeWidth={2.2} aria-hidden />
        </span>
        <h1 className="mt-8 text-3xl font-semibold leading-tight text-balance sm:text-4xl">{slide.title}</h1>
        <p className="mt-3 max-w-sm text-lg leading-snug text-muted-foreground text-pretty">{slide.body}</p>
      </main>

      <footer className="mx-auto w-full max-w-xl px-4 pb-6">
        <div className="mb-4 flex justify-center gap-1.5" aria-hidden>
          {slides.map((s, i) => (
            <span key={s.title} className={cn("h-2.5 rounded-full transition-all", i === step ? "w-6 bg-brand-bright" : "w-2.5 bg-muted")} />
          ))}
        </div>
        {last && slides.length === SLIDES.length ? (
          <div className="flex flex-col gap-2">
            <Button
              size="xl"
              className="w-full"
              disabled={busy}
              onClick={async () => {
                await toggleReminders();
                finish();
              }}
            >
              Turn on reminders
            </Button>
            <Button variant="ghost" size="xl" className="w-full" onClick={finish}>
              Maybe later
            </Button>
          </div>
        ) : (
          <Button size="xl" className="w-full" onClick={last ? finish : () => setStep(step + 1)}>
            {last ? "Let's go" : "Continue"}
          </Button>
        )}
      </footer>
    </div>
  );
}
