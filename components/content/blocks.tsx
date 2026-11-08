"use client";

import dynamic from "next/dynamic";
import { Expand } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Block, FigureBlock, Inline, Mark, TableBlock, TableCell } from "@/lib/content/types";
import { cn } from "@/lib/utils";

// Loaded only when a question has a formula, so plain questions stay light on data.
const MathRender = dynamic(() => import("@/components/content/math"), {
  loading: () => <span className="font-mono text-[0.9em] text-muted-foreground">…</span>,
});

const MARK_CLASS: Partial<Record<Mark, string>> = {
  bold: "font-bold",
  italic: "italic",
  underline: "underline decoration-2 underline-offset-[3px]",
  double_underline: "underline decoration-double decoration-1 underline-offset-[3px]",
  highlight: "rounded-sm bg-gold/40 px-0.5 text-foreground ring-1 ring-gold-edge/50",
};

function Marked({ text, marks = [] }: { text: string; marks?: Mark[] }) {
  const className = cn(marks.map((m) => MARK_CLASS[m]));
  const inner = className ? <span className={className}>{text}</span> : text;
  if (marks.includes("superscript")) return <sup>{inner}</sup>;
  if (marks.includes("subscript")) return <sub>{inner}</sub>;
  return inner;
}

export function InlineContent({ content }: { content: Inline[] }) {
  return content.map((part, i) =>
    "math" in part ? <MathRender key={i} tex={part.math} /> : <Marked key={i} text={part.text} marks={part.marks} />,
  );
}

function Cell({ as: Tag, cell, align, scope }: { as: "td" | "th"; cell: TableCell; align?: string; scope?: "col" | "row" }) {
  return (
    <Tag
      scope={scope}
      className={cn(
        "border border-border px-2.5 py-1.5 align-top whitespace-nowrap",
        align === "right" ? "text-right tabular-nums" : align === "center" ? "text-center" : "text-left",
        Tag === "th" && "bg-muted font-semibold",
      )}
    >
      {cell === null ? <span className="sr-only">Blank</span> : <InlineContent content={cell} />}
    </Tag>
  );
}

function DataTable({ block }: { block: TableBlock }) {
  return (
    // Wide tables scroll inside the question, so the page itself never scrolls sideways.
    // `relative` keeps the hidden "Blank" labels in this box too, or they would widen the page.
    <div tabIndex={0} role="region" aria-label="Table" className="relative max-w-full overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <table className="min-w-full border-collapse text-[0.92rem]">
        {block.caption ? (
          <caption className="pb-1.5 text-left text-sm font-semibold">
            <InlineContent content={block.caption} />
          </caption>
        ) : null}
        {block.header ? (
          <thead>
            {block.header.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <Cell key={c} as="th" scope="col" cell={cell} align={block.align?.[c]} />
                ))}
              </tr>
            ))}
          </thead>
        ) : null}
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <Cell key={c} as="td" cell={cell} align={block.align?.[c]} />
              ))}
            </tr>
          ))}
        </tbody>
        {block.footer ? (
          <tfoot className="font-semibold">
            {block.footer.map((row, r) => (
              <tr key={r} className="border-t-2 border-foreground">
                {row.map((cell, c) => (
                  <Cell key={c} as="td" cell={cell} align={block.align?.[c]} />
                ))}
              </tr>
            ))}
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function mediaUrl(src: string) {
  if (/^(data:|https:)/.test(src)) return src;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/question-media/${src}`;
}

/** Separate from the image, so it can sit beside an answer choice without nesting buttons. */
export function EnlargeFigure({ block, className }: { block: FigureBlock; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge image: ${block.alt}`}
        className={cn(
          "grid size-10 place-items-center rounded-lg bg-foreground/75 text-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        <Expand className="size-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-3xl">
          <DialogTitle className="sr-only">Enlarged image</DialogTitle>
          <div className="max-h-[80dvh] overflow-auto rounded-lg bg-white">
            <img src={mediaUrl(block.src)} alt={block.alt} className="h-auto w-full" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Figure({ block, enlarge }: { block: FigureBlock; enlarge: boolean }) {
  return (
    <figure>
      <div className="relative w-fit max-w-full overflow-hidden rounded-lg border bg-white">
        {/* Images, including SVGs, load through <img>, where embedded scripts cannot run. */}
        <img
          src={mediaUrl(block.src)}
          alt={block.alt}
          width={block.width}
          height={block.height}
          loading="lazy"
          className="h-auto max-h-72 w-auto max-w-full"
        />
        {enlarge ? <EnlargeFigure block={block} className="absolute right-1.5 bottom-1.5" /> : null}
      </div>
      {block.caption ? (
        <figcaption className="mt-1.5 text-sm text-muted-foreground">
          <InlineContent content={block.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}

function BlockView({ block, enlarge }: { block: Block; enlarge: boolean }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p>
          <InlineContent content={block.content} />
        </p>
      );
    case "math":
      return (
        <div className="relative max-w-full overflow-x-auto py-0.5 [&_.katex-display]:my-0">
          <MathRender tex={block.tex} display />
        </div>
      );
    case "quote":
      return (
        <blockquote className="rounded-xl border-2 bg-[#FBF8F1] px-4 py-3 font-[family-name:var(--font-reading)] text-[1.05rem] font-normal italic leading-[1.75] text-[#1F2A22] text-pretty">
          <InlineContent content={block.content} />
        </blockquote>
      );
    case "verse":
      return (
        <div className="space-y-4">
          {block.stanzas.map((stanza, s) => (
            <div key={s}>
              {stanza.map((line, l) => (
                <div key={l} className="grid grid-cols-[1.25rem_1fr] gap-1">
                  <span aria-hidden={line.number === undefined} className="select-none pt-0.5 text-right font-sans text-xs tabular-nums text-muted-foreground">
                    {line.number ?? ""}
                  </span>
                  <span className="pl-4 -indent-3">
                    <InlineContent content={line.content} />
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    case "dialogue":
      return (
        <dl className="space-y-1.5">
          {block.turns.map((turn, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr] gap-2">
              <dt className="font-display font-semibold">{turn.speaker}:</dt>
              <dd className="m-0">
                <InlineContent content={turn.content} />
              </dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return <DataTable block={block} />;
    case "figure":
      return <Figure block={block} enlarge={enlarge} />;
  }
}

/** The one renderer for question content. It knows nothing about modes, timing or answers. */
export function Blocks({ blocks, className, enlarge = true }: { blocks: Block[]; className?: string; enlarge?: boolean }) {
  return (
    <div className={cn("min-w-0 space-y-2.5", className)}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} enlarge={enlarge} />
      ))}
    </div>
  );
}
