"use server";

import { adminDb, isAdmin } from "@/lib/admin/auth";
import { parsePage, paperKey } from "@/lib/myquest/client";
import { checkBatch, type CheckedQuestion } from "@/lib/myquest/enrich/check";
import { parseReply } from "@/lib/myquest/enrich/parse";
import { buildPrompt, codeTopics, makeBatches, PROMPT_VERSION, type BatchQuestion, type TopicEntry } from "@/lib/myquest/enrich/prompt";
import { normalisePaper } from "@/lib/myquest/normalise";
import { MYQUEST_SUBJECTS } from "@/lib/myquest/subjects";
import type { Outcome, PaperInput } from "./types";

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

export interface BatchView {
  no: number;
  count: number;
  prompt: string;
  figures: { label: string; url: string; providerId: string | number }[];
  saved: { reply: string; model: string | null; savedAt: string } | null;
}

export interface ReplyResult {
  warnings: string[];
  truncated: boolean;
  error: string | null;
  unknownIds: string[];
  questions: CheckedQuestion[];
}

interface Loaded {
  paperId: string;
  subjectId: string;
  subjectName: string;
  topics: TopicEntry[];
  batches: BatchQuestion[][];
}

async function load(input: PaperInput): Promise<{ ok: true; data: Loaded } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Sign in again." };
  const subjectId = MYQUEST_SUBJECTS[input.subject];
  if (!subjectId) return { ok: false, error: "This subject is not in our list yet." };
  const ref = { exam: input.exam, exam_year_id: input.year, subject: input.subject };
  const db = adminDb();

  const { data: paper } = await db.from("import_papers").select("id, status").eq("paper_key", paperKey(ref)).maybeSingle();
  if (!paper) return { ok: false, error: "This paper has not been fetched yet." };
  if (paper.status !== "complete") return { ok: false, error: "This paper does not add up yet, so it can't be enriched. Fetch it again first." };

  const [{ data: pages }, { data: subject }, { data: topicRows }] = await Promise.all([
    db.from("import_pages").select("page, raw").eq("paper_id", paper.id).order("page"),
    db.from("subjects").select("name").eq("id", subjectId).single(),
    db.from("topics").select("id, name").eq("subject_id", subjectId).eq("active", true).order("sort_order").order("name"),
  ]);
  const ids = (topicRows ?? []).map((t) => t.id);
  const { data: subRows } = ids.length ? await db.from("subtopics").select("id, name, topic_id").in("topic_id", ids).eq("active", true).order("sort_order").order("name") : { data: [] };

  const topics = codeTopics(
    (topicRows ?? []).map((t) => ({ id: t.id, name: t.name, subtopics: (subRows ?? []).filter((s) => s.topic_id === t.id).map((s) => ({ id: s.id, name: s.name })) })),
    PREFIX[subjectId] ?? subjectId.slice(0, 2).toUpperCase(),
  );
  const rows = (pages ?? []).flatMap((p) => parsePage(p.raw).rows);
  const { questions } = normalisePaper(ref, rows);
  return { ok: true, data: { paperId: paper.id, subjectId, subjectName: subject?.name ?? input.subject, topics, batches: makeBatches(questions) } };
}

/** The prompts to copy, one per batch of ten questions, plus any reply already saved. */
export async function loadBatches(input: PaperInput): Promise<Outcome<{ batches: BatchView[] }>> {
  const l = await load(input);
  if (!l.ok) return l;
  const { paperId, subjectId, subjectName, topics, batches } = l.data;
  const { data: saved } = await adminDb().from("import_batch_replies").select("batch_no, reply, model, saved_at").eq("paper_id", paperId);
  return {
    ok: true,
    batches: batches.map((batch, i) => {
      const s = saved?.find((r) => r.batch_no === i + 1);
      return {
        no: i + 1,
        count: batch.length,
        prompt: buildPrompt({ subjectId, subjectName, batchNo: i + 1, batches: batches.length, topics, batch }),
        figures: batch.filter((b) => b.figure && b.question.remoteImage).map((b) => ({ label: b.figure!, url: b.question.remoteImage!, providerId: b.question.providerId })),
        saved: s ? { reply: s.reply, model: s.model, savedAt: s.saved_at } : null,
      };
    }),
  };
}

/** Parses a pasted reply, checks every question, and remembers the reply. Saves no questions. */
export async function checkReplyAction(input: PaperInput, batchNo: number, reply: string, model: string): Promise<Outcome<{ result: ReplyResult }>> {
  const l = await load(input);
  if (!l.ok) return l;
  const { paperId, subjectId, topics, batches } = l.data;
  const batch = batches[batchNo - 1];
  if (!batch) return { ok: false, error: "That batch does not exist." };
  if (reply.length > 400_000) return { ok: false, error: "That reply is too long to be right. Paste only the code block." };

  const parsed = parseReply(reply);
  const { questions, unknownIds } = parsed.error ? { questions: [], unknownIds: [] } : checkBatch(subjectId, batch, parsed.items, topics);

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
