"use client";

import { useRouter } from "next/navigation";
import { BookOpenCheck, Clock, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";

const MODES = [
  {
    icon: Zap,
    label: "Quick Five",
    hint: "5 questions, instantly",
    tint: "bg-gold-soft text-gold-ink",
    intro: "Five questions in a subject you choose, with an explanation after each one.",
  },
  {
    icon: BookOpenCheck,
    label: "Topic Practice",
    hint: "Drill weak topics",
    tint: "bg-sky-soft text-sky",
    intro: "Choose a subject and a topic, then work through questions at your own pace.",
  },
  {
    icon: Clock,
    label: "Timed Practice",
    hint: "Beat the clock",
    tint: "bg-flame-soft text-flame",
    intro: "Answer against a countdown, the way the real exam feels.",
  },
  {
    icon: Trophy,
    label: "Mock Exam",
    hint: "Full UTME CBT",
    tint: "bg-violet-soft text-violet",
    intro: "A full UTME-style paper across your four subjects, timed for two hours.",
  },
];

/**
 * The four practice-mode cards on the landing page. Visitors tap them expecting to practise,
 * so each opens a short sheet that leads into the same free practice start as the hero button.
 */
export function LandingModeCards() {
  const router = useRouter();
  const { account } = useAppState();
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const active = MODES.find((m) => m.label === openLabel) ?? null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Practice modes">
        {MODES.map(({ icon: Icon, label, hint, tint }) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => {
                void track("landing_card_click", { mode: label });
                setOpenLabel(label);
              }}
              className="game-card game-tap w-full p-4 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className={cn("grid size-10 place-items-center rounded-xl", tint)}>
                <Icon className="size-5" strokeWidth={2.4} aria-hidden />
              </span>
              <p className="mt-3 font-display font-semibold leading-tight">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setOpenLabel(null)}>
        <DialogContent className="gap-3 p-6 text-center">
          {active ? (
            <>
              <span aria-hidden className={cn("mx-auto grid size-16 place-items-center rounded-2xl", active.tint)}>
                <active.icon className="size-8" strokeWidth={2.2} />
              </span>
              <DialogTitle className="font-display text-2xl font-semibold">{active.label}</DialogTitle>
              <DialogDescription className="text-base leading-snug">{active.intro}</DialogDescription>
              <p className="font-display text-lg font-semibold">Ready to practise?</p>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  void track("landing_start_click", { mode: active.label, signedIn: Boolean(account) });
                  router.push(account ? "/practice" : "/start");
                }}
                className={buttonVariants({ size: "xl", className: "w-full" })}
              >
                Start practising
              </button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
