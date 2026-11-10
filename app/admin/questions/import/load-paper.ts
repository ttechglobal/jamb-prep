import { adminDb, isAdmin } from "@/lib/admin/auth";
import { parsePage, paperKey } from "@/lib/myquest/client";
import { codeTopics, makeBatches, type BatchQuestion, type TopicEntry } from "@/lib/myquest/enrich/prompt";
import { normalisePaper } from "@/lib/myquest/normalise";
import { MYQUEST_SUBJECTS } from "@/lib/myquest/subjects";
import type { PaperInput } from "./types";

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
  subjectName: string;
  year: number | null;
  topics: TopicEntry[];
  batches: BatchQuestion[][];
  /** The provider's row for each question, by provider id, kept for the audit trail. */
  rawById: Map<string, unknown>;
}

/** Everything about one fetched paper, rebuilt the same way every time so batch ids stay stable. */
export async function loadPaper(input: PaperInput): Promise<{ ok: true; data: Loaded } | { ok: false; error: string }> {
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
  return {
    ok: true,
    data: {
      paperId: paper.id,
      paperKey: paperKey(ref),
      subjectId,
      subjectName: subject?.name ?? input.subject,
      year: /^\d{4}$/.test(input.year) ? Number(input.year) : null,
      topics,
      batches: makeBatches(questions),
      rawById: new Map(rows.map((r) => [String(r.id), r])),
    },
  };
}

/** source_ref to the publish that made it live, for this paper. */
export async function publishedRefs(paperId: string): Promise<Map<string, string>> {
  const { data } = await adminDb().from("question_import_rows").select("source_ref, batch_id").eq("paper_id", paperId).eq("status", "imported");
  return new Map((data ?? []).map((r) => [r.source_ref as string, r.batch_id as string]));
}
