/**
 * Load, check and publish one paper's questions. Takes a database client instead of reading the admin
 * cookie, so the admin page and the command-line import script run exactly the same code.
 * Callers are responsible for authorising the caller.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { paperKey, parsePage } from "../client.ts";
import { normalisePaper } from "../normalise.ts";
import { checkImage, mediaPath, MIME } from "../media.ts";
import { setTextByProvider, subjectForProvider, usesSourceKey } from "../subjects.ts";
import { checkBatch, type CheckedQuestion } from "./check.ts";
import { parseReply } from "./parse.ts";
import { codeTopics, makeBatches, PROMPT_VERSION, type BatchQuestion, type TopicEntry } from "./prompt.ts";
import { buildRow, selectForPublish, type PublishRow } from "./publish.ts";

export type Db = SupabaseClient;
export type Outcome<T> = ({ ok: true } & T) | { ok: false; error: string };
export interface PaperInput {
  exam: string;
  year: string;
  subject: string;
}

/** Topic codes are prefixed per subject so a code is never mistaken for another subject's. */
const PREFIX: Record<string, string> = {
  english: "EN",
  mathematics: "MA",
  physics: "PH",
  chemistry: "CH",
  biology: "BI",
  economics: "EC",
  government: "GO",
  literature: "LI",
  commerce: "CO",
  accounting: "AC",
  crk: "CR",
};

export interface Loaded {
  paperId: string;
  paperKey: string;
  subjectId: string;
  /** The prescribed book these questions are about, when the paper is a set text. */
  workId: string | null;
  /** The source answer key is the answer (book questions). */
  sourceKey: boolean;
  subjectName: string;
  year: number | null;
  topics: TopicEntry[];
  batches: BatchQuestion[][];
  /** The provider's row for each question, by provider id, kept for the audit trail. */
  rawById: Map<string, unknown>;
}

/** Everything about one fetched paper, rebuilt the same way every time so batch ids stay stable. */
export async function loadPaperWith(db: Db, input: PaperInput): Promise<Outcome<{ data: Loaded }>> {
  const subjectId = subjectForProvider(input.subject);
  const setText = setTextByProvider(input.subject);
  if (!subjectId) return { ok: false, error: "This subject is not in our list yet." };
  const ref = { exam: input.exam, exam_year_id: input.year, subject: input.subject };

  const { data: paper } = await db.from("import_papers").select("id, status").eq("paper_key", paperKey(ref)).maybeSingle();
  if (!paper) return { ok: false, error: "This paper has not been fetched yet." };
  if (paper.status !== "complete") return { ok: false, error: "This paper does not add up yet, so it can't be enriched. Fetch it again first." };

  const [{ data: pages }, { data: subject }, { data: topicRows }] = await Promise.all([
    db.from("import_pages").select("page, raw").eq("paper_id", paper.id).order("page"),
    db.from("subjects").select("name").eq("id", subjectId).single(),
    db.from("topics").select("id, name").eq("subject_id", subjectId).eq("active", true).order("sort_order").order("name"),
  ]);
  let workId: string | null = null;
  if (setText) {
    const { data: work } = await db.from("prescribed_works").select("id").eq("title", setText.title).eq("author", setText.author).maybeSingle();
    if (!work) return { ok: false, error: `${setText.title} is not set up as a prescribed book yet. Apply the latest database migration.` };
    workId = work.id;
  }
  const ids = (topicRows ?? []).map((t) => t.id);
  const { data: subRows } = ids.length ? await db.from("subtopics").select("id, name, topic_id").in("topic_id", ids).eq("active", true).order("sort_order").order("name") : { data: [] };

  const topics = codeTopics(
    (topicRows ?? []).map((t) => ({ id: t.id, name: t.name, subtopics: (subRows ?? []).filter((s) => s.topic_id === t.id).map((s) => ({ id: s.id, name: s.name })) })),
    PREFIX[subjectId] ?? subjectId.slice(0, 2).toUpperCase(),
  );
  const rows = (pages ?? []).flatMap((p) => parsePage(p.raw).rows);
  const { questions } = normalisePaper(ref, rows);
  return {
    ok: true,
    data: {
      paperId: paper.id,
      paperKey: paperKey(ref),
      subjectId,
      workId,
      sourceKey: usesSourceKey(subjectId, input.subject),
      subjectName: setText?.title ?? subject?.name ?? input.subject,
      year: /^\d{4}$/.test(input.year) ? Number(input.year) : null,
      topics,
      batches: makeBatches(questions),
      rawById: new Map(rows.map((r) => [String(r.id), r])),
    },
  };
}

/** source_ref to the publish that made it live, for this paper. */
export async function publishedRefsWith(db: Db, paperId: string): Promise<Map<string, string>> {
  const { data } = await db.from("question_import_rows").select("source_ref, batch_id").eq("paper_id", paperId).eq("status", "imported");
  return new Map((data ?? []).map((r) => [r.source_ref as string, r.batch_id as string]));
}

// Check -----------------------------------------------------------------------

export interface ReplyResult {
  warnings: string[];
  truncated: boolean;
  error: string | null;
  unknownIds: string[];
  questions: CheckedQuestion[];
}

/** Parses a reply, checks every question, and remembers the reply. Saves no questions. */
export async function checkReplyWith(db: Db, input: PaperInput, batchNo: number, reply: string, model: string): Promise<Outcome<{ result: ReplyResult }>> {
  const l = await loadPaperWith(db, input);
  if (!l.ok) return l;
  const { paperId, subjectId, topics, batches, sourceKey } = l.data;
  const batch = batches[batchNo - 1];
  if (!batch) return { ok: false, error: "That batch does not exist." };
  if (reply.length > 400_000) return { ok: false, error: "That reply is too long to be right. Paste only the code block." };

  const parsed = parseReply(reply);
  const { questions, unknownIds } = parsed.error ? { questions: [], unknownIds: [] } : checkBatch(subjectId, batch, parsed.items, topics, { sourceKey });

  // Never offer to publish a question twice.
  const live = await publishedRefsWith(db, paperId);
  for (const q of questions) {
    if (live.has(q.sourceRef)) {
      q.flags.push({ code: "already_published", severity: "block" });
      q.publishable = false;
    }
  }

  await db.from("import_batch_replies").upsert(
    {
      paper_id: paperId,
      batch_no: batchNo,
      reply,
      model: model.trim().slice(0, 80) || null,
      prompt_version: PROMPT_VERSION,
      summary: { questions: questions.length, publishable: questions.filter((q) => q.publishable).length, warnings: parsed.warnings, truncated: parsed.truncated, error: parsed.error },
      saved_at: new Date().toISOString(),
    },
    { onConflict: "paper_id,batch_no" },
  );
  return { ok: true, result: { warnings: parsed.warnings, truncated: parsed.truncated, error: parsed.error, unknownIds, questions } };
}

// Publish ---------------------------------------------------------------------

export interface PublishResult {
  /** The publish, for Undo. Null when nothing was published. */
  batchId: string | null;
  published: number;
  /** Questions not published, by position in the paper, with a plain reason. */
  notPublished: { position: number; reason: string }[];
}

export const REASON: Record<string, string> = {
  already_published: "already published from this paper",
  already_in_bank: "this exact question is already in the bank for this year",
  figure_failed: "its diagram could not be saved",
};

/** Downloads a source diagram, checks it is a safe image, and stores it in the public question-media bucket. */
export async function saveFigure(db: Db, key: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const check = checkImage(buf);
    if (!check.ok) return null;
    const path = mediaPath(key, check.sha256, check.kind);
    const { error } = await db.storage.from("question-media").upload(path, buf, { contentType: MIME[check.kind], upsert: false });
    if (error && !/already exists|Duplicate/i.test(error.message)) return null;
    return path;
  } catch {
    return null;
  }
}

/**
 * Publishes the reviewed questions of one batch to students. It uses the reply that was saved when the
 * batch was checked, never text passed in, and re-runs every check. `acceptAi` lists questions where the
 * reviewer accepted the AI's answer over MyQuest's.
 */
export async function publishBatchWith(db: Db, input: PaperInput, batchNo: number, acceptAi: string[]): Promise<Outcome<{ result: PublishResult }>> {
  const l = await loadPaperWith(db, input);
  if (!l.ok) return l;
  const { paperId, paperKey: key, subjectId, workId, sourceKey, year, topics, batches, rawById } = l.data;
  const batch = batches[batchNo - 1];
  if (!batch) return { ok: false, error: "That batch does not exist." };

  const { data: saved } = await db.from("import_batch_replies").select("reply, model").eq("paper_id", paperId).eq("batch_no", batchNo).maybeSingle();
  if (!saved) return { ok: false, error: "Check a reply for this batch first." };

  const parsed = parseReply(saved.reply);
  if (parsed.error) return { ok: false, error: parsed.error };
  const { questions } = checkBatch(subjectId, batch, parsed.items, topics, { sourceKey });

  const live = await publishedRefsWith(db, paperId);
  const overrides = new Set(acceptAi);
  const { include, excluded } = selectForPublish(questions, overrides, new Set(live.keys()));
  const notPublished = excluded.map((e) => ({
    position: e.position,
    reason: e.reason === "already_published" ? REASON.already_published : "it still has a problem that needs fixing",
  }));

  const rows: PublishRow[] = [];
  const positionOf = new Map<string, number>();
  for (const q of include) {
    let figureSrc: string | null = null;
    if (q.figure) {
      figureSrc = await saveFigure(db, key, q.figure.url);
      if (!figureSrc) {
        notPublished.push({ position: q.position, reason: REASON.figure_failed });
        continue;
      }
    }
    positionOf.set(q.sourceRef, q.position);
    rows.push(buildRow(q, { subjectId, workId, sourceKey, year, raw: rawById.get(String(q.providerId)) ?? {}, figureSrc, model: saved.model, promptVersion: PROMPT_VERSION, overridden: overrides.has(q.id) && q.flags.some((f) => f.code === "key_disputed") }));
  }

  if (!rows.length) return { ok: true, result: { batchId: null, published: 0, notPublished: notPublished.sort((a, b) => a.position - b.position) } };

  const { data, error } = await db.rpc("import_publish", { p_paper: paperId, p_batch_no: batchNo, p_rows: rows });
  if (error || !data) return { ok: false, error: "Publishing failed and nothing was saved. Try again." };
  const out = data as { batch_id: string; inserted: number; skipped: { source_ref: string; reason: string }[] };
  for (const s of out.skipped) notPublished.push({ position: positionOf.get(s.source_ref) ?? 0, reason: REASON[s.reason] ?? s.reason });

  return { ok: true, result: { batchId: out.inserted ? out.batch_id : null, published: out.inserted, notPublished: notPublished.sort((a, b) => a.position - b.position) } };
}
