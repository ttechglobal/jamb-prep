"use server";

import { adminDb, isAdmin } from "@/lib/admin/auth";
import { publishBatchWith, REASON, type PublishResult } from "@/lib/myquest/enrich/server";
import { shuffleOptions } from "@/lib/myquest/enrich/shuffle";
import { loadPaper, publishedRefs } from "./load-paper";
import type { Outcome, PaperInput } from "./types";

export type { PublishResult };

/** Publishes the reviewed questions of one batch to students, straight away. See publishBatchWith. */
export async function publishBatchAction(input: PaperInput, batchNo: number, acceptAi: string[]): Promise<Outcome<{ result: PublishResult }>> {
  if (!(await isAdmin())) return { ok: false, error: "Sign in again." };
  return publishBatchWith(adminDb(), input, batchNo, acceptAi);
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
