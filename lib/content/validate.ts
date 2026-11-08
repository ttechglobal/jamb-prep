import type { Block, Inline, OptionKey, QuestionOption, SharedContext } from "@/lib/content/types";

export type ContentIssue =
  | "blank_stem"
  | "wrong_option_count"
  | "empty_option"
  | "missing_answer"
  | "invalid_answer"
  | "unresolved_marked_text"
  | "missing_extract"
  | "missing_figure"
  | "missing_table"
  | "figure_without_alt"
  | "uneven_table";

export interface QuestionDraft {
  instruction?: Block[] | null;
  context?: Pick<SharedContext, "blocks"> | null;
  stem: Block[];
  options: QuestionOption[];
  correctOption?: string | null;
}

const KEYS: OptionKey[] = ["A", "B", "C", "D"];

const inlineText = (content: Inline[] = []) => content.map((c) => ("text" in c ? c.text : c.math)).join("");

/** Readable text of a set of blocks, for checks and search. Not for display. */
export function plainText(blocks: Block[] = []): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "paragraph":
          return inlineText(b.content);
        case "math":
          return b.tex;
        case "quote":
          return inlineText(b.content);
        case "verse":
          return b.stanzas.flat().map((l) => inlineText(l.content)).join(" ");
        case "dialogue":
          return b.turns.map((t) => inlineText(t.content)).join(" ");
        case "table":
          return [...(b.header ?? []), ...b.rows, ...(b.footer ?? [])].flat().map((c) => inlineText(c ?? [])).join(" ");
        case "figure":
          return b.alt;
      }
    })
    .join(" ")
    .trim();
}

const hasContent = (blocks: Block[] = []) => blocks.some((b) => b.type !== "paragraph" || inlineText(b.content).trim().length > 0);
const contains = (blocks: Block[] = [], type: Block["type"]) => blocks.some((b) => b.type === type);

function hasMarkedText(blocks: Block[] = []): boolean {
  const marked = (content: Inline[]) => content.some((c) => "marks" in c && c.marks?.length);
  return blocks.some((b) => b.type === "paragraph" && marked(b.content));
}

const REFERS_TO_MARKED = /\b(underlined|in bold|italicised|italicized|in italics|stressed (syllable|word)|highlighted)\b/i;
const REFERS_TO_EXTRACT = /\b(the|this|following|above|below) (comprehension )?(passage|extract|excerpt|poem|stanza|dialogue)\b|\b(statements?|passage|extract) (below|above)\b/i;
const REFERS_TO_FIGURE =
  /\b(diagram|figure|fig\.|graph|chart|map|illustration|apparatus|document|cartoon) (above|below|shown)\b|\b(above|below|following|given|accompanying) (diagram|figure|graph|chart|map|illustration|apparatus|document|reaction|cartoon)\b|^(in|from|using|use) the (diagram|figure|graph|chart|map)\b|\bthe (diagram|figure) (shows|represents)\b|periodic table section/i;
const REFERS_TO_TABLE = /\btable (above|below|shown|given)\b|\b(the following|the above|in the|from the previous|the frequency) table\b|\bprevious question\b/i;

/** "The device in this excerpt" is fine when the excerpt is written out in the stem itself. */
function needsSeparateExtract(wording: string) {
  const hit = wording.match(REFERS_TO_EXTRACT);
  if (!hit) return false;
  return (hit.index ?? 0) < 25;
}

/** Rules that decide if a question can enter the bank. Used by the import and, later, admin. */
export function validateQuestion(q: QuestionDraft): ContentIssue[] {
  const issues = new Set<ContentIssue>();
  const optionBlocks = q.options.flatMap((o) => o.blocks);
  const shown = [...(q.context?.blocks ?? []), ...q.stem, ...optionBlocks];
  const wording = `${plainText(q.instruction ?? [])} ${plainText(q.stem)}`;

  if (!hasContent(q.stem)) issues.add("blank_stem");

  if (q.options.length !== 4 || !KEYS.every((k) => q.options.some((o) => o.key === k))) issues.add("wrong_option_count");
  if (q.options.some((o) => !hasContent(o.blocks))) issues.add("empty_option");

  const answer = q.correctOption?.trim();
  if (!answer) issues.add("missing_answer");
  else if (!KEYS.includes(answer as OptionKey)) issues.add("invalid_answer");

  if (REFERS_TO_MARKED.test(wording) && !hasMarkedText(shown)) issues.add("unresolved_marked_text");
  if (needsSeparateExtract(wording.trim()) && !hasContent(q.context?.blocks)) issues.add("missing_extract");
  if (REFERS_TO_FIGURE.test(wording) && !contains(shown, "figure") && !wording.includes("→")) issues.add("missing_figure");
  if (REFERS_TO_TABLE.test(wording) && !contains(shown, "table")) issues.add("missing_table");

  for (const b of shown) {
    if (b.type === "figure" && !b.alt.trim()) issues.add("figure_without_alt");
    if (b.type === "table") {
      const rows = [...(b.header ?? []), ...b.rows, ...(b.footer ?? [])];
      if (new Set(rows.map((r) => r.length)).size > 1) issues.add("uneven_table");
    }
  }

  return [...issues];
}
