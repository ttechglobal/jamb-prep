/**
 * Turns one MyQuest row into our content format, or says why it cannot.
 * Deterministic and offline: no AI, no network, so it can be re-run on stored pages whenever
 * the rules change. It never fixes a key or invents context. It only reads, converts and flags.
 */
import { createHash } from "node:crypto";
import type { Block, Inline, Mark, OptionKey, QuestionOption, Solution } from "../content/types.ts";
import { plainText, validateQuestion, type ContentIssue } from "../content/validate.ts";
import { sourceRef, type PaperRef } from "./client.ts";

export const NORMALISER_VERSION = "mq-1";

const KEYS: OptionKey[] = ["A", "B", "C", "D"];

export type Reason =
  | ContentIssue
  | "bad_row"
  | "not_four_options"
  | "duplicate_option_text"
  | "option_label_stripped"
  | "answer_not_in_options"
  | "missing_explanation"
  | "placeholder_explanation"
  | "explanation_admits_problem"
  | "explanation_names_other_option"
  | "figure_needs_media"
  | "duplicate_in_paper"
  | "unclear_text";

/** Reasons that stop a row being usable at all. Everything else holds it for review. */
const REJECT: Reason[] = ["bad_row", "blank_stem", "missing_answer", "invalid_answer", "answer_not_in_options", "not_four_options", "wrong_option_count", "empty_option"];
/** Noted for information. They do not hold a row. */
const NOTE_ONLY: Reason[] = ["option_label_stripped"];

export interface NormalisedQuestion {
  sourceRef: string;
  providerId: string | number;
  stem: Block[];
  options: QuestionOption[];
  correctOption: OptionKey | null;
  /** The text of the keyed option, kept beside the letter so a changed key is visible in review. */
  correctText: string | null;
  solution: Solution | null;
  /** Provider image still to be downloaded into our storage. Never shown from this URL. */
  remoteImage: string | null;
  reasons: Reason[];
  status: "ready" | "held" | "rejected";
  contentHash: string;
  normaliserVersion: string;
}

// Text -----------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°", times: "×", divide: "÷", plusmn: "±", micro: "µ", ohm: "Ω" };

function decode(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const TAG_MARKS: Record<string, Mark> = { u: "underline", b: "bold", strong: "bold", i: "italic", em: "italic", sup: "superscript", sub: "subscript" };

/** Marks safe tags, drops every other tag, and turns x^2 style powers into superscripts. */
function inline(raw: string): Inline[] {
  const out: Inline[] = [];
  const stack: Mark[] = [];
  const push = (t: string) => {
    if (!t) return;
    const marks = [...stack];
    const last = out[out.length - 1];
    if (last && "text" in last && JSON.stringify(last.marks ?? []) === JSON.stringify(marks)) last.text += t;
    else out.push(marks.length ? { text: t, marks } : { text: t });
  };
  const withPowers = (t: string) => {
    const re = /\^(\{[^}]+\}|-?\d+)/g;
    let at = 0;
    for (let m; (m = re.exec(t)); ) {
      push(t.slice(at, m.index));
      stack.push("superscript");
      push(m[1].replace(/^\{|\}$/g, ""));
      stack.pop();
      at = m.index + m[0].length;
    }
    push(t.slice(at));
  };
  raw = raw.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const parts = raw.split(/(<\/?[a-z][a-z0-9]*[^>]*>)/i);
  for (const part of parts) {
    const tag = part.match(/^<(\/?)([a-z][a-z0-9]*)[^>]*>$/i);
    if (!tag) {
      withPowers(decode(part));
      continue;
    }
    const mark = TAG_MARKS[tag[2].toLowerCase()];
    if (!mark) continue;
    if (tag[1]) {
      const i = stack.lastIndexOf(mark);
      if (i >= 0) stack.splice(i, 1);
    } else stack.push(mark);
  }
  return out;
}

/** A blank line starts a paragraph. A single newline inside one is kept as a space. */
function blocks(raw: unknown): Block[] {
  if (typeof raw !== "string") return [];
  const text = raw.replace(/\r\n?/g, "\n").replace(/<br\s*\/?>/gi, "\n\n").trim();
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((p): Block => ({ type: "paragraph", content: inline(p) }));
}

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

// Options ---------------------------------------------------------------------

const LABEL = /^\(?([A-Da-d])[.):]\s+(?=\S)/;

/** Reads the option map. Returns the options in A to D order plus reasons found on the way. */
function readOptions(raw: unknown, reasons: Set<Reason>): QuestionOption[] {
  const entries: [string, string][] = [];
  if (Array.isArray(raw)) raw.forEach((v, i) => entries.push([KEYS[i] ?? String(i), String(v ?? "")]));
  else if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw)) entries.push([k.trim().toUpperCase(), typeof v === "string" ? v : String(v ?? "")]);

  const options: QuestionOption[] = [];
  for (const key of KEYS) {
    const hit = entries.find(([k]) => k === key);
    if (!hit) continue;
    let text = hit[1];
    // Strip an embedded "A. " only when it names this option's own letter, so "B. Smith" stays intact.
    const label = text.match(LABEL);
    if (label && label[1].toUpperCase() === key) {
      text = text.slice(label[0].length);
      reasons.add("option_label_stripped");
    }
    options.push({ key, blocks: blocks(text) });
  }
  if (entries.length !== 4 || options.length !== 4) reasons.add("not_four_options");
  return options;
}

// Explanation -----------------------------------------------------------------

const ADMITS_PROBLEM = /\b(none of the (given )?(options|answers|choices)|no (correct )?(option|answer)|best (guess|answer|fit|option)|closest (option|answer)|typo|misprint|error in (the )?(question|options)|not (clearly )?(stated|given|provided)|data (is|are) missing|cannot be determined|incorrectly (stated|given))\b/i;
const PLACEHOLDER = /^(x|n\/a|none|null|tbd|-+|\.+)$/i;

function explanationReasons(explanation: string, key: OptionKey | null, reasons: Set<Reason>) {
  if (!explanation) {
    reasons.add("missing_explanation");
    return;
  }
  if (PLACEHOLDER.test(explanation) || explanation.length < 8) reasons.add("placeholder_explanation");
  if (ADMITS_PROBLEM.test(explanation)) reasons.add("explanation_admits_problem");
  // Only an explicit "option C" / "answer is C" counts. A bare letter could be a variable or a unit.
  if (key) {
    const named = [...explanation.matchAll(/\b(?:option|answer is|correct answer is|correct option is)\s*\(?([A-D])\)?(?![A-Za-z])/g)].map((m) => m[1]);
    if (named.length && !named.includes(key)) reasons.add("explanation_names_other_option");
  }
}

// Row -------------------------------------------------------------------------

const normForHash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Same stem and same set of options, in any order, is the same question. */
export function fingerprint(stem: Block[], options: QuestionOption[]): string {
  const opts = options.map((o) => normForHash(plainText(o.blocks))).sort();
  return createHash("sha256").update([normForHash(plainText(stem)), ...opts].join("|")).digest("hex").slice(0, 32);
}

export function normaliseRow(ref: PaperRef, row: Record<string, unknown>): NormalisedQuestion {
  const reasons = new Set<Reason>();
  const id = row.id as string | number;
  if (id === undefined || id === null || id === "") reasons.add("bad_row");

  const stem = blocks(row.question ?? row.question_text);
  const options = readOptions(row.options ?? row.option, reasons);

  // Two options with the same text means the key cannot be told apart.
  const texts = options.map((o) => normForHash(plainText(o.blocks))).filter(Boolean);
  if (new Set(texts).size < texts.length) reasons.add("duplicate_option_text");

  const keyRaw = clean(row.correct_answer ?? row.answer).toUpperCase();
  const key = (KEYS as string[]).includes(keyRaw) ? (keyRaw as OptionKey) : null;
  const keyedOption = key ? options.find((o) => o.key === key) : undefined;
  if (!keyRaw) reasons.add("missing_answer");
  else if (!key) reasons.add("invalid_answer");
  else if (!keyedOption) reasons.add("answer_not_in_options");

  const explanationText = clean(row.explanation ?? row.solution);
  explanationReasons(explanationText, key, reasons);
  const solution: Solution | null = explanationText ? { answer: blocks(row.explanation ?? row.solution) } : null;

  const image = typeof row.image === "string" && row.image.trim() ? row.image.trim() : null;
  // A figure the question depends on needs our own copy and a written description. Until then it is held.
  if (image) reasons.add("figure_needs_media");

  // The shared content rules. A figure the stem points to counts as present only once it is attached.
  for (const issue of validateQuestion({ stem, options, correctOption: key })) reasons.add(issue);
  if (image) reasons.delete("missing_figure");

  const list = [...reasons];
  const rejected = list.some((r) => REJECT.includes(r));
  const held = list.some((r) => !NOTE_ONLY.includes(r));
  return {
    sourceRef: sourceRef(ref, id),
    providerId: id,
    stem,
    options,
    correctOption: key,
    correctText: keyedOption ? plainText(keyedOption.blocks) : null,
    solution,
    remoteImage: image,
    reasons: list,
    status: rejected ? "rejected" : held ? "held" : "ready",
    contentHash: fingerprint(stem, options),
    normaliserVersion: NORMALISER_VERSION,
  };
}

export interface PaperReport {
  total: number;
  ready: number;
  held: number;
  rejected: number;
  byReason: Record<string, number>;
  /** How the keys are spread. A bank written by hand is roughly even. */
  keyCounts: Record<OptionKey, number>;
  keySkew: boolean;
}

/** Normalises a whole paper, then looks across it for duplicates and a skewed key. */
export function normalisePaper(ref: PaperRef, rows: Record<string, unknown>[]): { questions: NormalisedQuestion[]; report: PaperReport } {
  const questions = rows.map((r) => normaliseRow(ref, r));

  const seen = new Map<string, NormalisedQuestion>();
  for (const q of questions) {
    const first = seen.get(q.contentHash);
    if (!first) seen.set(q.contentHash, q);
    else {
      q.reasons.push("duplicate_in_paper");
      if (q.status === "ready") q.status = "held";
    }
  }

  const keyCounts: Record<OptionKey, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const q of questions) if (q.correctOption) keyCounts[q.correctOption]++;
  const keyed = Object.values(keyCounts).reduce((a, b) => a + b, 0);
  // With 40 questions an honest paper puts about 10 on each letter. A letter holding more than
  // half, or a letter never used, points at a generated or mis-keyed paper.
  const skew = keyed >= 20 && (Math.max(...Object.values(keyCounts)) / keyed > 0.5 || Object.values(keyCounts).some((n) => n === 0));

  const byReason: Record<string, number> = {};
  for (const q of questions) for (const r of q.reasons) byReason[r] = (byReason[r] ?? 0) + 1;
  return {
    questions,
    report: {
      total: questions.length,
      ready: questions.filter((q) => q.status === "ready").length,
      held: questions.filter((q) => q.status === "held").length,
      rejected: questions.filter((q) => q.status === "rejected").length,
      byReason,
      keyCounts,
      keySkew: skew,
    },
  };
}
