import type { Block, Inline } from "@/lib/content/types";

/**
 * Many literature and English questions put a short excerpt in quotation marks at the start of the
 * stem: “The sun smiled upon the fields.” The literary device used in this excerpt is...
 * This lifts that quotation out into its own `quote` block at display time, so every such question
 * in the bank reads as an excerpt without rewriting any stored data. A question that stores a
 * `quote` block itself is left alone.
 */

const MIN_WORDS = 5;
const OPEN = /^\s*[“"‘'’]/;

const textOnly = (content: Inline[]) => content.every((c) => "text" in c);
const joined = (content: Inline[]) => content.map((c) => ("text" in c ? c.text : "")).join("");

/** Characters start..end of a run of text, keeping each run's marks (bold, italic and so on). */
function slice(content: Inline[], start: number, end: number): Inline[] {
  const out: Inline[] = [];
  let pos = 0;
  for (const part of content) {
    if (!("text" in part)) continue;
    const from = Math.max(start, pos);
    const to = Math.min(end, pos + part.text.length);
    if (to > from) out.push({ ...part, text: part.text.slice(from - pos, to - pos) });
    pos += part.text.length;
  }
  return out;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function liftExcerpt(stem: Block[]): Block[] {
  const [first, ...rest] = stem;
  if (!first || first.type !== "paragraph" || !textOnly(first.content)) return stem;

  const text = joined(first.content);
  if (!OPEN.test(text)) return stem;

  const open = text.search(/[“"‘'’]/);
  const mark = text[open];
  const closer = mark === "“" ? "”" : mark === "‘" || mark === "’" ? "’" : mark;

  // Try each closing mark in turn: one followed by a space, punctuation or the end. An apostrophe
  // inside a word is never followed by a space, and an apostrophe that is (as in "the boys' ball")
  // fails the checks below, so the search moves on to the real end of the excerpt.
  for (let close = open + 1; close < text.length; close++) {
    if (text[close] !== closer) continue;
    if (close !== text.length - 1 && !/[\s.,;:!?)]/.test(text[close + 1])) continue;

    const inner = text.slice(open + 1, close);
    if (words(inner) < MIN_WORDS) continue;

    const after = text.slice(close + 1).replace(/^[\s.,;:]+/, "");
    // "said Ada" after a quote means dialogue, not an excerpt followed by a question.
    if (after && !/^[A-Z0-9“"‘'(]/.test(after)) continue;

    const quote: Block = { type: "quote", content: slice(first.content, open + 1, close) };
    const remainder = after ? slice(first.content, text.length - after.length, text.length) : [];
    if (remainder.length) return [quote, { type: "paragraph", content: remainder }, ...rest];
    // A quote with nothing after it only counts if a question follows in the next block.
    return rest.length ? [quote, ...rest] : stem;
  }
  return stem;
}
