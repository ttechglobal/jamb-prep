"use client";

import dynamic from "next/dynamic";
import { AlertTriangle, Lightbulb, Sparkles } from "lucide-react";
import { InlineContent } from "@/components/content/blocks";
import type { ReadBlock } from "@/lib/read/types";
import { cn } from "@/lib/utils";

const MathRender = dynamic(() => import("@/components/content/math"), {
  loading: () => <span className="font-mono text-[0.9em] text-muted-foreground">…</span>,
});

const TONES = {
  tip: { icon: Lightbulb, box: "bg-gold-soft text-gold-ink", label: "text-gold-ink" },
  mistake: { icon: AlertTriangle, box: "bg-flame-soft text-flame", label: "text-flame" },
  know: { icon: Sparkles, box: "bg-sky-soft text-sky", label: "text-sky" },
} as const;

/** One section of a lesson: serif text for reading, with key terms, callouts, equations and key points set apart. */
export function LessonBlocks({ blocks }: { blocks: ReadBlock[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "text":
            return (
              <div key={i} className="flex flex-col gap-3.5 font-serif text-[1.08rem] leading-[1.75]">
                {b.paragraphs.map((p, k) => (
                  <p key={k}>
                    <InlineContent content={p} />
                  </p>
                ))}
              </div>
            );
          case "terms":
            return (
              <dl key={i} className="game-card p-4">
                <p className="font-display text-sm font-semibold tracking-wide text-muted-foreground">KEY TERMS</p>
                {b.terms.map((t) => (
                  <div key={t.term} className="mt-2.5">
                    <dt className="font-display text-base font-semibold">{t.term}</dt>
                    <dd className="text-[0.95rem] leading-snug text-muted-foreground">{t.meaning}</dd>
                  </div>
                ))}
              </dl>
            );
          case "callout": {
            const tone = TONES[b.tone];
            const Icon = tone.icon;
            return (
              <aside key={i} className={cn("rounded-2xl p-4", tone.box)}>
                <p className={cn("flex items-center gap-2 font-display text-base font-semibold", tone.label)}>
                  <Icon className="size-5" aria-hidden />
                  {b.title}
                </p>
                <p className="mt-1.5 text-[0.98rem] leading-snug text-foreground">
                  <InlineContent content={b.text} />
                </p>
              </aside>
            );
          }
          case "equation":
            return (
              <figure key={i} className="game-card p-4 text-center">
                <div className="overflow-x-auto py-1 text-lg">
                  <MathRender tex={b.tex} display />
                </div>
                {b.caption ? <figcaption className="mt-1 text-sm font-medium">{b.caption}</figcaption> : null}
                {b.explanation ? <p className="mt-1 text-sm text-muted-foreground">{b.explanation}</p> : null}
              </figure>
            );
          case "points":
            return (
              <section key={i} className="game-card p-4">
                <h3 className="font-display text-lg font-semibold">{b.title}</h3>
                <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[0.98rem] leading-snug marker:text-primary">
                  {b.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </section>
            );
        }
      })}
    </div>
  );
}
