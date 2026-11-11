"use server";

import { adminDb, isAdmin } from "@/lib/admin/auth";
import { checkBatch } from "@/lib/myquest/enrich/check";
import { parseReply } from "@/lib/myquest/enrich/parse";
import { PROMPT_VERSION } from "@/lib/myquest/enrich/prompt";
import { buildRow, selectForPublish, type PublishRow } from "@/lib/myquest/enrich/publish";
import { checkImage, mediaPath, MIME } from "@/lib/myquest/media";
import { shuffleOptions } from "@/lib/myquest/enrich/shuffle";
import { loadPaper, publishedRefs } from "./load-paper";
import type { Outcome, PaperInput } from "./types";

export interface PublishResult {
  /** The publish, for Undo. Null when nothing was published. */
  batchId: string | null;
  published: number;
  /** Questions not published, by position in the paper, with a plain reason. */
  notPublished: { position: number; reason: string }[];
}

const REASON: Record<string, string> = {
  already_published: "already published from this paper",
  already_in_bank: "this exact question is already in the bank for this year",
  figure_failed: "its diagram could not be saved",
};

/** Downloads a source diagram, checks it is a safe image, and stores it in the public question-media bucket. */
async function saveFigure(db: ReturnType<typeof adminDb>, paperKey: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const check = checkImage(buf);
    if (!check.ok) return null;
    const path = mediaPath(paperKey, check.sha256, check.kind);
    const { error } = await db.storage.from("question-media").upload(path, buf, { contentType: MIME[check.kind], upsert: false });
    if (error && !/already exists|Duplicate/i.test(error.message)) return null;
    return path;
  } catch {
    return null;
  }
}

/**
 * Publishes the reviewed questions of one batch to students, straight away. It uses the reply that
 * was saved when the batch was checked, never text sent from the browser, and re-runs every check.
 * `acceptAi` lists questions where the reviewer accepted the AI's answer over MyQuest's.
 */
export async function publishBatchAction(input: PaperInput, batchNo: number, acceptAi: string[]): Promise<Outcome<{ result: PublishResult }>> {
  const l = await loadPaper(input);
  if (!l.ok) return l;
  const { paperId, paperKey, subjectId, workId, sourceKey, year, topics, batches, rawById } = l.data;
  const batch = batches[batchNo - 1];
  if (!batch) return { ok: false, error: "That batch does not exist." };

  const db = adminDb();
  const { data: saved } = await db.from("import_batch_replies").select("reply, model").eq("paper_id", paperId).eq("batch_no", batchNo).maybeSingle();
  if (!saved) return { ok: false, error: "Check a reply for this batch first." };

  const parsed = parseReply(saved.reply);
  if (parsed.error) return { ok: false, error: parsed.error };
  const { questions } = checkBatch(subjectId, batch, parsed.items, topics, { sourceKey });

  const live = await publishedRefs(paperId);
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
      figureSrc = await saveFigure(db, paperKey, q.figure.url);
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

/** Takes a published batch back. Unanswered questions are removed. Any already in someone's practice are retired. */
export async function undoPublishAction(batchId: string): Promise<Outcome<{ deleted: number; retired: number }>> {
  if (!(await isAdmin())) return { ok: false, error: "Sign in again." };
  if (!/^[0-9a-f-]{36}$/.test(batchId)) return { ok: false, error: "That publish is not recognised." };
  const { data, error } = await adminDb().rpc("import_undo", { p_batch: batchId });
  if (error || !data) return { ok: false, error: "Couldn't undo that. Nothing was changed." };
  const r = data as { deleted: number; retired: number };
  return { ok: true, deleted: r.deleted, retired: r.retired };
}

/**
 * Publishes a set-text paper (for example The Lekki Headmaster) straight from the source: its answer key
 * is the answer, there is no AI step and no explanation. Only questions the importer rates ready go live.
 * They are filed under English, linked to the book, and tagged to the reading-text topic.
 */
export async function publishSourceAction(input: PaperInput): Promise<Outcome<{ result: PublishResult; held: number }>> {
  const l = await loadPaper(input);
  if (!l.ok) return l;
  const { paperId, subjectId, workId, sourceKey, year, batches } = l.data;
  if (!workId || !sourceKey) return { ok: false, error: "Only a prescribed book can be published without the AI step." };

  const db = adminDb();
  const { data: topic } = await db.from("topics").select("id").eq("subject_id", subjectId).eq("name", "Comprehension and Summary").maybeSingle();
  const { data: sub } = topic ? await db.from("subtopics").select("id").eq("topic_id", topic.id).eq("name", "Approved Reading Text Comprehension").maybeSingle() : { data: null };

  const all = batches.flat();
  const ready = all.filter((b) => b.question.status === "ready" && b.question.correctOption);
  const rows = ready.map((b) => {
    const mixed = shuffleOptions(b.question.sourceRef, b.question.stem, b.question.options, b.question.correctOption!, null);
    return {
    source_ref: b.question.sourceRef,
    subject_id: subjectId,
    work_id: workId,
    topic_id: topic?.id ?? null,
    subtopic_id: sub?.id ?? null,
    year,
    stem: b.question.stem,
    options: mixed.options,
    correct_option: mixed.correct,
    raw: l.data.rawById.get(String(b.question.providerId)) ?? {},
    normalised: { keySource: "source", optionsShuffled: mixed.shuffled, normaliserVersion: b.question.normaliserVersion },
    notes: [],
  };
  });
  const held = all.length - ready.length;
  if (!rows.length) return { ok: true, result: { batchId: null, published: 0, notPublished: [] }, held };

  const { data, error } = await db.rpc("import_publish", { p_paper: paperId, p_batch_no: 1, p_rows: rows });
  if (error || !data) return { ok: false, error: "Publishing failed and nothing was saved. Try again." };
  const out = data as { batch_id: string; inserted: number; skipped: { source_ref: string; reason: string }[] };
  const position = new Map(ready.map((b) => [b.question.sourceRef, b.position]));
  const notPublished = out.skipped.map((s) => ({ position: position.get(s.source_ref) ?? 0, reason: REASON[s.reason] ?? s.reason })).sort((a, b) => a.position - b.position);
  return { ok: true, result: { batchId: out.inserted ? out.batch_id : null, published: out.inserted, notPublished }, held };
}
