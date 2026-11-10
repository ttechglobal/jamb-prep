"use server";

import { adminDb } from "@/lib/admin/auth";
import { checkBatch, type CheckedQuestion } from "@/lib/myquest/enrich/check";
import { parseReply } from "@/lib/myquest/enrich/parse";
import { buildPrompt, PROMPT_VERSION } from "@/lib/myquest/enrich/prompt";
import { loadPaper, publishedRefs } from "./load-paper";
import type { Outcome, PaperInput } from "./types";

export interface BatchView {
  no: number;
  count: number;
  prompt: string;
  figures: { label: string; url: string; providerId: string | number }[];
  saved: { reply: string; model: string | null; savedAt: string } | null;
  /** Questions from this batch already live, and the publishes that put them there. */
  published: { count: number; batches: { id: string; count: number }[] };
}

export interface ReplyResult {
  warnings: string[];
  truncated: boolean;
  error: string | null;
  unknownIds: string[];
  questions: CheckedQuestion[];
}

/** The prompts to copy, one per batch of ten questions, plus any reply already saved. */
export async function loadBatches(input: PaperInput): Promise<Outcome<{ batches: BatchView[] }>> {
  const l = await loadPaper(input);
  if (!l.ok) return l;
  const { paperId, subjectId, subjectName, topics, batches } = l.data;
  const [{ data: saved }, live] = await Promise.all([adminDb().from("import_batch_replies").select("batch_no, reply, model, saved_at").eq("paper_id", paperId), publishedRefs(paperId)]);
  return {
    ok: true,
    batches: batches.map((batch, i) => {
      const s = saved?.find((r) => r.batch_no === i + 1);
      const perPublish = new Map<string, number>();
      for (const b of batch) {
        const id = live.get(b.question.sourceRef);
        if (id) perPublish.set(id, (perPublish.get(id) ?? 0) + 1);
      }
      return {
        no: i + 1,
        count: batch.length,
        prompt: buildPrompt({ subjectId, subjectName, batchNo: i + 1, batches: batches.length, topics, batch }),
        figures: batch.filter((b) => b.figure && b.question.remoteImage).map((b) => ({ label: b.figure!, url: b.question.remoteImage!, providerId: b.question.providerId })),
        saved: s ? { reply: s.reply, model: s.model, savedAt: s.saved_at } : null,
        published: { count: [...perPublish.values()].reduce((a, b) => a + b, 0), batches: [...perPublish].map(([id, count]) => ({ id, count })) },
      };
    }),
  };
}

/** Parses a pasted reply, checks every question, and remembers the reply. Saves no questions. */
export async function checkReplyAction(input: PaperInput, batchNo: number, reply: string, model: string): Promise<Outcome<{ result: ReplyResult }>> {
  const l = await loadPaper(input);
  if (!l.ok) return l;
  const { paperId, subjectId, topics, batches } = l.data;
  const batch = batches[batchNo - 1];
  if (!batch) return { ok: false, error: "That batch does not exist." };
  if (reply.length > 400_000) return { ok: false, error: "That reply is too long to be right. Paste only the code block." };

  const parsed = parseReply(reply);
  const { questions, unknownIds } = parsed.error ? { questions: [], unknownIds: [] } : checkBatch(subjectId, batch, parsed.items, topics);

  // Never offer to publish a question twice.
  const live = await publishedRefs(paperId);
  for (const q of questions) {
    if (live.has(q.sourceRef)) {
      q.flags.push({ code: "already_published", severity: "block" });
      q.publishable = false;
    }
  }

  await adminDb().from("import_batch_replies").upsert(
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
