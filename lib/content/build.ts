import type { Block, Inline, Mark } from "@/lib/content/types";

export const text = (value: string, ...marks: Mark[]): Inline => (marks.length ? { text: value, marks } : { text: value });
export const math = (tex: string): Inline => ({ math: tex });
export const paragraph = (...content: (string | Inline)[]): Block => ({
  type: "paragraph",
  content: content.map((c) => (typeof c === "string" ? { text: c } : c)),
});

/** Plain text to blocks. A blank line starts a new paragraph. */
export function textBlocks(value: string): Block[] {
  return value
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => paragraph(part));
}
