"use client";

import { Route, Star, Zap } from "lucide-react";
import type { PathMode } from "@/lib/path/types";
import { cn } from "@/lib/utils";

const CHOICES: { value: PathMode; title: string; text: string; icon: typeof Route; tint: string; tag?: string }[] = [
  {
    value: "path",
    title: "Follow my path",
    text: "Go topic by topic in each subject. Earn stars as you go and always know what is next.",
    icon: Route,
    tint: "bg-violet-soft text-violet",
    tag: "Recommended",
  },
  {
    value: "practice",
    title: "Just practise",
    text: "Jump into questions whenever you like. Your path waits on Home if you change your mind.",
    icon: Zap,
    tint: "bg-gold-soft text-gold-ink",
  },
];

/** The last onboarding step. Both choices lead into the same app, and either can be switched later. */
export function StartChoice({ value, onChange }: { value: PathMode; onChange: (mode: PathMode) => void }) {
  return (
    <div role="radiogroup" aria-label="How do you want to start?" className="flex flex-col gap-3.5">
      {CHOICES.map(({ value: v, title, text, icon: Icon, tint, tag }) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={cn(
              "game-card relative flex items-start gap-3.5 p-4 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on && "border-brand-bright bg-success-soft/60",
            )}
          >
            {tag ? (
              <span className="absolute -top-3 right-4 rounded-full bg-gold px-2.5 py-0.5 font-display text-xs font-semibold text-gold-ink shadow-[0_2px_0_0_var(--gold-edge)]">
                {tag}
              </span>
            ) : null}
            <span aria-hidden className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", tint)}>
              <Icon className="size-7" strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-xl leading-tight font-semibold">{title}</span>
              <span className="mt-1 block text-sm leading-snug text-muted-foreground">{text}</span>
              {v === "path" ? (
                <span aria-hidden className="mt-2.5 flex gap-1">
                  <Star className="size-5 fill-gold text-gold-edge" strokeWidth={1.8} />
                  <Star className="size-5 fill-gold text-gold-edge" strokeWidth={1.8} />
                  <Star className="size-5 fill-muted text-border" strokeWidth={1.8} />
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
