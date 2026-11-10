/**
 * Turns the AI's text fields into our content blocks. The AI never writes block JSON.
 * Deterministic: the same text always gives the same blocks, and anything it cannot
 * represent is reported, not guessed.
 */
import type { Block, Inline, Mark, OptionKey, Solution } from "../../content/types.ts";

export interface ConvertProblem {
  field: string;
  problem: "unbalanced_marks" | "unbalanced_dollar" | "empty";
}

/** Inline text with $maths$, **bold**, *italic* and <u>underline</u>. */
export function textToInline(raw: string): { inline: Inline[]; unbalanced: boolean; dollarsUnbalanced: boolean } {
  const out: Inline[] = [];
  const stack: Mark[] = [];
  let unbalanced = false;

  const push = (t: string) => {
    if (!t) return;
    const marks = [...stack];
    const last = out[out.length - 1];
    if (last && "text" in last && JSON.stringify(last.marks ?? []) === JSON.stringify(marks)) last.text += t;
    else out.push(marks.length ? { text: t, marks } : { text: t });
  };
  const toggle = (m: Mark) => {
    const i = stack.lastIndexOf(m);
    if (i >= 0) stack.splice(i, 1);
    else stack.push(m);
  };

  // Split into maths and text. A backslash before a dollar makes it a plain dollar sign.
  const parts: { math: boolean; value: string }[] = [];
  let buf = "";
  let inMath = false;
  let dollarsUnbalanced = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\" && raw[i + 1] === "$" && !inMath) {
      buf += "$";
      i++;
    } else if (c === "$") {
      parts.push({ math: inMath, value: buf });
      buf = "";
      inMath = !inMath;
    } else buf += c;
  }
  if (inMath) {
    dollarsUnbalanced = true;
    parts.push({ math: false, value: `$${buf}` });
  } else parts.push({ math: false, value: buf });

  for (const part of parts) {
    if (part.math) {
      if (part.value.trim()) out.push({ math: part.value.trim() });
      continue;
    }
    const tokens = part.value.split(/(\*\*|\*|<u>|<\/u>)/);
    for (const t of tokens) {
      if (t === "**") toggle("bold");
      else if (t === "*") toggle("italic");
      else if (t === "<u>") stack.push("underline");
      else if (t === "</u>") {
        const i = stack.lastIndexOf("underline");
        if (i >= 0) stack.splice(i, 1);
        else unbalanced = true;
      } else push(t);
    }
  }
  if (stack.length) unbalanced = true;
  return { inline: out, unbalanced, dollarsUnbalanced };
}

/** A blank line starts a paragraph. A line that is only $maths$ becomes a maths block. */
export function textToBlocks(raw: unknown, field: string, problems: ConvertProblem[]): Block[] {
  if (typeof raw !== "string") return [];
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const blocks: Block[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    const line = para.replace(/\s*\n\s*/g, " ").trim();
    if (!line) continue;
    const onlyMath = /^\$([^$]+)\$$/.exec(line);
    if (onlyMath) {
      blocks.push({ type: "math", tex: onlyMath[1].trim() });
      continue;
    }
    const { inline, unbalanced, dollarsUnbalanced } = textToInline(line);
    if (unbalanced) problems.push({ field, problem: "unbalanced_marks" });
    if (dollarsUnbalanced) problems.push({ field, problem: "unbalanced_dollar" });
    blocks.push({ type: "paragraph", content: inline });
  }
  return blocks;
}

/** One block per entry: each line of a step, each variable. */
function eachLine(lines: unknown, field: string, problems: ConvertProblem[]): Block[] {
  if (!Array.isArray(lines)) return [];
  return lines.flatMap((l) => (typeof l === "string" ? textToBlocks(l, field, problems) : []));
}

const KEYS: OptionKey[] = ["A", "B", "C", "D"];

export interface ConvertedSolution {
  solution: Solution;
  hint: Block[];
  problems: ConvertProblem[];
}

/** The AI item's explanation fields, as a v2 Solution. */
export function toSolution(item: Record<string, unknown>): ConvertedSolution {
  const problems: ConvertProblem[] = [];
  const str = (k: string) => (typeof item[k] === "string" ? (item[k] as string).trim() : "");

  const steps = Array.isArray(item.steps)
    ? item.steps.flatMap((s, i) => {
        const o = s as { title?: unknown; lines?: unknown };
        const title = typeof o?.title === "string" ? o.title.trim() : "";
        const blocks = eachLine(o?.lines, `steps[${i}]`, problems);
        return title && blocks.length ? [{ title, blocks }] : [];
      })
    : [];

  const wrongOptions: Partial<Record<OptionKey, Block[]>> = {};
  const wrong = (item.wrong ?? {}) as Record<string, unknown>;
  for (const k of KEYS) {
    const blocks = textToBlocks(wrong[k], `wrong.${k}`, problems);
    if (blocks.length) wrongOptions[k] = blocks;
  }

  const solution: Solution = {
    answer: textToBlocks(str("why"), "why", problems),
    concept: str("concept") || undefined,
    intro: textToBlocks(str("intro"), "intro", problems),
    formula: textToBlocks(str("formula"), "formula", problems),
    variables: eachLine(item.variables, "variables", problems),
    steps,
    wrongOptions,
    studyTip: textToBlocks(str("tip"), "tip", problems),
  };
  for (const k of ["intro", "formula", "variables", "steps", "studyTip"] as const) {
    const v = solution[k];
    if (Array.isArray(v) && !v.length) delete solution[k];
  }
  return { solution, hint: textToBlocks(str("hint"), "hint", problems), problems };
}

/** Every maths string in a set of blocks, so each can be checked by actually rendering it. */
export function mathIn(blocks: Block[] = []): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "math") out.push(b.tex);
    else if (b.type === "paragraph" || b.type === "quote") for (const c of b.content) if ("math" in c) out.push(c.math);
  }
  return out;
}
