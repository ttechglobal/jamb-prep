"use client";

import { BookOpen, ChevronDown, MessageSquareQuote, ScrollText, Type } from "lucide-react";
import { useState } from "react";
import { Blocks } from "@/components/content/blocks";
import type { ContextKind, SharedContext } from "@/lib/content/types";
import { cn } from "@/lib/utils";

const LABEL: Record<ContextKind, string> = {
  passage: "Passage",
  poem: "Poem",
  extract: "Extract",
  dialogue: "Dialogue",
  data: "Data",
  figure: "Figure",
};

/** Each kind of reading material gets its own look, so a student knows at a glance what they are reading. */
const LOOK: Record<ContextKind, { chip: string; icon: React.ComponentType<{ className?: string }> }> = {
  passage: { chip: "bg-secondary text-secondary-foreground", icon: BookOpen },
  poem: { chip: "bg-violet-soft text-violet", icon: ScrollText },
  extract: { chip: "bg-flame-soft text-flame", icon: MessageSquareQuote },
  dialogue: { chip: "bg-gold-soft text-gold-ink", icon: MessageSquareQuote },
  data: { chip: "bg-sky-soft text-sky", icon: BookOpen },
  figure: { chip: "bg-sky-soft text-sky", icon: BookOpen },
};

const SIZES = ["text-[1rem]", "text-[1.125rem]", "text-[1.25rem]"] as const;
/** Poems start a step smaller, since lines are short and should not wrap on a phone. */
const POEM_SIZES = ["text-[0.95rem]", "text-[1.05rem]", "text-[1.2rem]"] as const;

/** "Passage: The Market" already has a chip saying Passage, so the title drops the repeat. */
function cleanTitle(title: string | null, label: string) {
  if (!title) return null;
  const stripped = title.replace(new RegExp(`^${label}\\s*[:\\-–]\\s*`, "i"), "").trim();
  return stripped && stripped.toLowerCase() !== label.toLowerCase() ? stripped : null;
}

/**
 * Reading material shown with the question: set like a page in a book (serif face, warm paper,
 * generous line height), not like app text. On a phone it scrolls inside its own box and can be
 * folded away, so the choices stay reachable. Parents key this by context id, so the learner's
 * fold and text-size choices carry across every question that shares the passage.
 */
export function SharedContextPanel({ context }: { context: SharedContext }) {
  const [open, setOpen] = useState(true);
  const [size, setSize] = useState(0);
  const label = LABEL[context.kind];
  const look = LOOK[context.kind];
  const title = cleanTitle(context.title, label);
  const Icon = look.icon;
  const reading = context.kind === "passage" || context.kind === "poem" || context.kind === "extract" || context.kind === "dialogue";

  return (
    <section
      aria-label={context.title ?? label}
      className="overflow-hidden rounded-2xl border-2 bg-[#FBF8F1]"
    >
      <div className="flex min-h-12 items-center gap-2 px-3 py-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[0.7rem] font-bold uppercase tracking-wider", look.chip)}>
            <Icon className="size-3.5" aria-hidden />
            {label}
          </span>
          {/* Open: the title sits above the text, where it has room to wrap. Folded: it stays here. */}
          <span className="min-w-0 flex-1 truncate font-display text-base font-semibold">{open ? null : title}</span>
          <span className="sr-only">{open ? "Hide" : "Show"}</span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && reading ? (
          <button
            type="button"
            onClick={() => setSize((size + 1) % SIZES.length)}
            aria-label={`Text size, now ${["normal", "large", "largest"][size]}. Tap to change.`}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Type className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          tabIndex={0}
          className="max-h-[46dvh] overflow-y-auto border-t border-black/10 px-4 py-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 lg:max-h-[62dvh]"
        >
          {title ? <h3 className="mb-3 font-display text-xl font-semibold leading-snug">{title}</h3> : null}
          <div
            className={cn(
              reading && "font-[family-name:var(--font-reading)] leading-[1.8] text-[#1F2A22]",
              reading && (context.kind === "poem" ? POEM_SIZES[size] : SIZES[size]),
              // Prose: indented paragraphs, no gaps, the way a printed passage reads.
              context.kind === "passage" && "[&_p+p]:indent-7 [&>div]:space-y-0 [&_p]:text-pretty",
              // Extracts from set books read as a quotation.
              context.kind === "extract" && "italic [&_dt]:not-italic",
              context.kind === "poem" && "[&_span]:text-pretty",
            )}
          >
            <Blocks blocks={context.blocks} className={context.kind === "passage" ? "space-y-0" : undefined} />
          </div>
          {context.credit ? (
            <p className="mt-4 border-t border-black/10 pt-2 text-right font-display text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {context.credit}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
