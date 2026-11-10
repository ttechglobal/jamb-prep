/**
 * Decides which reviewed questions go live and shapes each one for the database.
 * Pure, so the rules that protect students can be tested without a database.
 */
import type { Block } from "../../content/types.ts";
import type { CheckedQuestion } from "./check.ts";

export interface Excluded {
  id: string;
  position: number;
  reason: "blocked" | "already_published";
  /** The blocking flags still standing, for the message shown to the reviewer. */
  flags: string[];
}

/**
 * A question goes live only with no blocking flag. The one flag a reviewer may override is a
 * disagreement on the answer, by accepting the AI's answer, because the explanation was written
 * for that answer. Nothing else can be overridden here.
 */
export function blockingFlags(q: CheckedQuestion, overrides: ReadonlySet<string>): string[] {
  return q.flags.filter((f) => f.severity === "block" && !(f.code === "key_disputed" && overrides.has(q.id))).map((f) => f.code);
}

export function selectForPublish(
  checked: CheckedQuestion[],
  overrides: ReadonlySet<string>,
  alreadyPublished: ReadonlySet<string>,
): { include: CheckedQuestion[]; excluded: Excluded[] } {
  const include: CheckedQuestion[] = [];
  const excluded: Excluded[] = [];
  for (const q of checked) {
    if (alreadyPublished.has(q.sourceRef)) {
      excluded.push({ id: q.id, position: q.position, reason: "already_published", flags: [] });
      continue;
    }
    const flags = blockingFlags(q, overrides);
    if (flags.length || !q.aiKey || !q.solution) excluded.push({ id: q.id, position: q.position, reason: "blocked", flags });
    else include.push(q);
  }
  return { include, excluded };
}

export interface PublishRow {
  source_ref: string;
  subject_id: string;
  topic_id: string | null;
  subtopic_id: string | null;
  year: number | null;
  stem: Block[];
  options: CheckedQuestion["options"];
  correct_option: string;
  hint: Block[] | null;
  solution: NonNullable<CheckedQuestion["solution"]>;
  raw: unknown;
  normalised: Record<string, unknown>;
  notes: string[];
}

export function buildRow(
  q: CheckedQuestion,
  ctx: { subjectId: string; year: number | null; raw: unknown; figureSrc: string | null; model: string | null; promptVersion: string; overridden: boolean },
): PublishRow {
  if (!q.aiKey || !q.solution) throw new Error("question is not solved");
  const figure: Block[] = ctx.figureSrc ? [{ type: "figure", src: ctx.figureSrc, alt: q.figureAlt }] : [];
  return {
    source_ref: q.sourceRef,
    subject_id: ctx.subjectId,
    topic_id: q.topic?.topicId ?? null,
    subtopic_id: q.subtopic?.subtopicId ?? null,
    year: ctx.year,
    stem: [...figure, ...q.stem],
    options: q.options,
    correct_option: q.aiKey,
    hint: q.hint.length ? q.hint : null,
    solution: q.solution,
    raw: ctx.raw,
    normalised: {
      aiKey: q.aiKey,
      providerKey: q.providerKey,
      confidence: q.confidence,
      topic: q.topic?.code ?? null,
      subtopic: q.subtopic?.code ?? null,
      model: ctx.model,
      promptVersion: ctx.promptVersion,
      keyOverridden: ctx.overridden,
    },
    notes: [...(ctx.overridden ? ["key_overridden"] : []), ...q.flags.filter((f) => f.severity === "warn").map((f) => f.code)],
  };
}
