/**
 * Joins the AI's reply to the fetched questions and finds everything wrong with it, before
 * anything can be saved. A "block" flag stops a question being published until a person fixes or
 * overrides it. A "warn" flag is for the reviewer's judgement.
 */
import katex from "katex";
import type { Block, OptionKey, QuestionOption, Solution } from "../../content/types.ts";
import { plainText } from "../../content/validate.ts";
import { mathIn, toSolution } from "./convert.ts";
import { MODULE_FOR_SUBJECT } from "./modules.ts";
import type { BatchQuestion, TopicEntry } from "./prompt.ts";
import type { RawItem } from "./parse.ts";

export type Severity = "block" | "warn";
export interface Flag {
  code: string;
  severity: Severity;
  detail?: string;
}

export interface CheckedQuestion {
  id: string;
  position: number;
  providerId: string | number;
  sourceRef: string;
  stem: Block[];
  options: QuestionOption[];
  providerKey: OptionKey | null;
  aiKey: OptionKey | null;
  status: string;
  confidence: string;
  topic: { code: string; name: string; topicId: string } | null;
  subtopic: { code: string; name: string; subtopicId: string } | null;
  solution: Solution | null;
  hint: Block[];
  figure: { label: string; url: string } | null;
  figureAlt: string;
  illustration: string;
  aiIssues: string[];
  flags: Flag[];
  publishable: boolean;
}

export interface BatchCheck {
  questions: CheckedQuestion[];
  /** Ids in the reply that match no question in this batch. */
  unknownIds: string[];
}

const KEYS: OptionKey[] = ["A", "B", "C", "D"];
const GENERIC_WRONG = /^(this|that|it)?\s*(option|answer|choice)?\s*(is|was)?\s*(incorrect|wrong|not correct|false)\.?$/i;

/** Reasons from the source side that still matter. The provider's own explanation no longer does. */
const SOURCE_BLOCK = new Set(["duplicate_option_text", "missing_figure", "missing_table", "missing_extract", "unresolved_marked_text", "figure_without_alt", "uneven_table"]);
const SOURCE_WARN = new Set(["duplicate_in_paper", "figure_needs_media"]);

const asString = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const asStrings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : []);

function badMath(tex: string): boolean {
  try {
    katex.renderToString(tex, { throwOnError: true });
    return false;
  } catch {
    return true;
  }
}

/** Prose that names an option by letter, which breaks if options are ever shuffled. */
const LETTER_IN_PROSE = /\boptions?\s*\(?[A-D]\)?(?![A-Za-z])|\b(?:answer|choice)\s+(?:is\s+)?\(?[A-D]\)?(?![A-Za-z])|\([A-D]\)/;

export function checkBatch(subjectId: string, batch: BatchQuestion[], items: RawItem[], topics: TopicEntry[]): BatchCheck {
  const moduleKey = MODULE_FOR_SUBJECT[subjectId] ?? "recall";
  const byId = new Map<string, RawItem[]>();
  const unknownIds: string[] = [];
  const known = new Set(batch.map((b) => b.id));
  for (const it of items) {
    const id = asString(it.id);
    if (!known.has(id)) {
      unknownIds.push(id || "(no id)");
      continue;
    }
    byId.set(id, [...(byId.get(id) ?? []), it]);
  }

  const topicByCode = new Map(topics.map((t) => [t.code, t]));
  const subByCode = new Map(topics.flatMap((t) => t.subs.map((s) => [s.code, { topic: t, sub: s }] as const)));

  const questions = batch.map((b): CheckedQuestion => {
    const q = b.question;
    const flags: Flag[] = [];
    const flag = (code: string, severity: Severity, detail?: string) => flags.push({ code, severity, detail });
    const stemText = plainText(q.stem);

    // Source-side problems found when the paper was normalised.
    for (const r of q.reasons) {
      if (SOURCE_BLOCK.has(r)) flag(r, "block");
      else if (SOURCE_WARN.has(r)) flag(r, "warn");
    }

    const base: CheckedQuestion = {
      id: b.id,
      position: b.position,
      providerId: q.providerId,
      sourceRef: q.sourceRef,
      stem: q.stem,
      options: q.options,
      providerKey: q.correctOption,
      aiKey: null,
      status: "none",
      confidence: "",
      topic: null,
      subtopic: null,
      solution: null,
      hint: [],
      figure: b.figure && q.remoteImage ? { label: b.figure, url: q.remoteImage } : null,
      figureAlt: "",
      illustration: "",
      aiIssues: [],
      flags,
      publishable: false,
    };

    const found = byId.get(b.id);
    if (!found) {
      flag("not_answered", "block");
      return base;
    }
    if (found.length > 1) flag("duplicate_reply", "block");
    const item = found[0];

    const status = asString(item.status);
    base.status = status || "none";
    base.aiIssues = asStrings(item.issues);
    if (!["solved", "missing_context", "ambiguous", "unsure"].includes(status)) {
      flag("item_invalid", "block", "The status is missing or not recognised.");
      return base;
    }
    if (status !== "solved") {
      const extra = status === "ambiguous" ? `Could be: ${asStrings(item.alternatives).join(", ") || "not said"}.` : status === "unsure" ? `Best guess: ${asString(item.best_guess) || "none"}.` : "";
      flag("status_not_solved", "block", [base.aiIssues.join(" "), extra].filter(Boolean).join(" "));
      return base;
    }

    // Answer.
    const answer = asString(item.answer).toUpperCase();
    if (!q.options.some((o) => o.key === answer)) flag("bad_answer", "block", answer ? `The AI answered "${answer}".` : "No answer was given.");
    else {
      base.aiKey = answer as OptionKey;
      if (q.correctOption && q.correctOption !== answer) flag("key_disputed", "block", `The AI says ${answer}. MyQuest says ${q.correctOption}.`);
    }
    base.confidence = asString(item.confidence);
    if (base.confidence && base.confidence !== "certain") flag("confidence_likely", "warn");

    // Topic.
    const tcode = asString(item.topic);
    const scode = asString(item.subtopic);
    if (!tcode || tcode.toLowerCase() === "none") {
      if (topics.length) flag("no_topic", "warn");
    } else {
      const t = topicByCode.get(tcode);
      if (!t) flag("topic_invalid", "block", `"${tcode}" is not on the list.`);
      else {
        base.topic = { code: t.code, name: t.name, topicId: t.id };
        if (scode && scode.toLowerCase() !== "none") {
          const s = subByCode.get(scode);
          if (!s || s.topic.code !== t.code) flag("topic_invalid", "block", `Subtopic "${scode}" does not sit under ${t.code}.`);
          else base.subtopic = { code: s.sub.code, name: s.sub.name, subtopicId: s.sub.id };
        }
      }
    }

    // Explanation.
    const { solution, hint, problems } = toSolution(item);
    base.solution = solution;
    base.hint = hint;
    if (!solution.answer.length) flag("explanation_empty", "block");
    if (problems.some((p) => p.problem === "unbalanced_marks")) flag("marks_unbalanced", "block", [...new Set(problems.filter((p) => p.problem === "unbalanced_marks").map((p) => p.field))].join(", "));
    if (problems.some((p) => p.problem === "unbalanced_dollar")) flag("dollar_unbalanced", "block", [...new Set(problems.filter((p) => p.problem === "unbalanced_dollar").map((p) => p.field))].join(", "));

    // Every formula must actually render.
    const allBlocks: Block[] = [
      ...(solution.answer ?? []),
      ...(solution.intro ?? []),
      ...(solution.formula ?? []),
      ...(solution.variables ?? []),
      ...(solution.steps ?? []).flatMap((s) => s.blocks),
      ...Object.values(solution.wrongOptions ?? {}).flat(),
      ...(solution.studyTip ?? []),
      ...hint,
    ];
    const broken = mathIn(allBlocks).filter(badMath);
    if (broken.length) flag("math_invalid", "block", broken.slice(0, 3).join("  |  "));

    // Wrong-option reasons: exactly the other options, each saying something.
    const others = q.options.map((o) => o.key).filter((k) => k !== base.aiKey);
    const wrongGiven = Object.keys((item.wrong ?? {}) as object).map((k) => k.toUpperCase());
    if (base.aiKey && (others.some((k) => !wrongGiven.includes(k)) || wrongGiven.some((k) => !others.includes(k as OptionKey)))) {
      flag("wrong_set", "block", `Expected ${others.join(", ")}, got ${wrongGiven.join(", ") || "none"}.`);
    } else {
      for (const k of others) {
        const text = plainText(solution.wrongOptions?.[k] ?? []);
        if (text.length < 15 || GENERIC_WRONG.test(text)) {
          flag("wrong_thin", "warn", k);
          break;
        }
      }
    }

    // Style rules.
    const prose = [asString(item.why), asString(item.intro), asString(item.tip), asString(item.hint), ...Object.values((item.wrong ?? {}) as Record<string, unknown>).map(asString)].join(" ");
    if (LETTER_IN_PROSE.test(prose)) flag("letter_in_prose", "warn");
    if (/^the correct answer is/i.test(asString(item.why))) flag("correct_phrase", "warn");
    if (asString(item.why).length > 700) flag("explanation_long", "warn");

    const hasSteps = (solution.steps?.length ?? 0) > 0;
    const numeric = /\d/.test(stemText) && q.options.some((o) => /\d/.test(plainText(o.blocks)));
    if (moduleKey === "calc" && numeric && !hasSteps) flag("steps_missing", "warn");
    if ((moduleKey === "language" || moduleKey === "recall") && hasSteps) flag("steps_unneeded", "warn");

    // Figure and illustration.
    base.figureAlt = asString(item.figure_alt);
    if (q.remoteImage && !base.figureAlt) flag("figure_needs_description", "block");
    base.illustration = asString(item.illustration);
    if (base.illustration) flag("illustration_requested", "warn", base.illustration);

    return base;
  });

  for (const c of questions) c.publishable = !c.flags.some((f) => f.severity === "block");
  return { questions, unknownIds };
}
