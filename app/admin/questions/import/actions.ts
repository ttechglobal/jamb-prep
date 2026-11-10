"use server";

import { adminDb, isAdmin } from "@/lib/admin/auth";
import { createClient, fetchCatalogue, fetchPaper, MyQuestError, paperKey, parsePage, type FetchedPage, type PaperRef } from "@/lib/myquest/client";
import { yearRows, type StagedInfo, type YearRow } from "@/lib/myquest/gaps";
import { normalisePaper } from "@/lib/myquest/normalise";
import { MYQUEST_SUBJECTS, providerName } from "@/lib/myquest/subjects";
import { describeIssue, type DryRunResult, type FetchResult, type Option, type Outcome, type PaperInput, type PaperStatus } from "./types";

const ADAPTER = "mq-1";

const client = () => createClient({ apiKey: process.env.MYQUEST_API_KEY });

function friendly(e: unknown): string {
  if (e instanceof MyQuestError) {
    switch (e.kind) {
      case "config":
        return "The MyQuest key is missing on the server.";
      case "auth":
        return "MyQuest rejected the key. Check it and the account balance.";
      case "rate_limited":
        return "MyQuest is limiting requests. Wait a minute and try again.";
      case "upstream":
      case "network":
        return "Couldn't reach MyQuest. Nothing was lost. Try again.";
      default:
        return "MyQuest sent something unexpected. The raw reply was not saved.";
    }
  }
  return "Something went wrong. Nothing was changed.";
}

function clean(input: PaperInput): PaperRef | null {
  const ok = (s: unknown) => typeof s === "string" && s.trim().length > 0 && s.length <= 100;
  if (!ok(input?.exam) || !ok(input?.year) || !ok(input?.subject)) return null;
  return { exam: input.exam.trim(), exam_year_id: input.year.trim(), subject: input.subject.trim() };
}

// Catalogue -------------------------------------------------------------------

export async function loadCatalogue(kind: "exam" | "exam_year_id" | "subject", parent: { exam?: string; year?: string }): Promise<Outcome<{ options: Option[] }>> {
  if (!(await isAdmin())) return { ok: false, error: "Sign in again." };
  try {
    const { entries } = await fetchCatalogue(client(), kind, { exam: parent.exam, exam_year_id: parent.year });
    return { ok: true, options: entries.map((e) => ({ value: String(e.value), label: e.label })) };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

/** What we already hold for this paper, so it is not fetched twice. */
export async function paperStatus(input: PaperInput): Promise<Outcome<{ status: PaperStatus }>> {
  if (!(await isAdmin())) return { ok: false, error: "Sign in again." };
  const ref = clean(input);
  if (!ref) return { ok: false, error: "Pick an exam, year and subject." };
  const db = adminDb();
  const subjectId = MYQUEST_SUBJECTS[ref.subject] ?? null;
  const year = /^\d{4}$/.test(String(ref.exam_year_id)) ? Number(ref.exam_year_id) : null;

  let inBank = 0;
  if (subjectId && year) {
    const { count } = await db.from("questions").select("id", { count: "exact", head: true }).eq("subject_id", subjectId).eq("year", year).neq("status", "retired");
    inBank = count ?? 0;
  }
  const { data } = await db.from("import_papers").select("status, fetched_total, id").eq("paper_key", paperKey(ref)).maybeSingle();
  let staged: PaperStatus["staged"] = null;
  if (data) {
    const { count } = await db.from("import_pages").select("page", { count: "exact", head: true }).eq("paper_id", data.id);
    staged = { status: data.status, fetched: data.fetched_total, pages: count ?? 0 };
  }
  // Does MyQuest list this subject for this year? Unknown (null) if the lookup fails, which never blocks.
  let listed: boolean | null = null;
  try {
    const { entries } = await fetchCatalogue(client(), "subject", { exam: ref.exam, exam_year_id: ref.exam_year_id });
    listed = entries.some((e) => String(e.value) === ref.subject);
  } catch {
    listed = null;
  }
  return { ok: true, status: { subjectId, inBank, staged, listed } };
}

/**
 * For one of our subjects: every JAMB year MyQuest lists, marked as held, fetched or a gap.
 * Listing years costs nothing.
 */
export async function yearsForSubject(subjectId: string): Promise<Outcome<{ rows: YearRow[]; provider: string }>> {
  if (!(await isAdmin())) return { ok: false, error: "Sign in again." };
  const provider = providerName(subjectId);
  if (!provider) return { ok: false, error: "MyQuest has no matching subject for this one." };
  const db = adminDb();
  try {
    const [catalogue, coverage, papers] = await Promise.all([
      fetchCatalogue(client(), "exam_year_id", { exam: "JAMB" }),
      db.rpc("admin_question_coverage"),
      db.from("import_papers").select("provider_year, status, fetched_total").eq("provider_exam", "JAMB").eq("provider_subject", provider),
    ]);
    const bank = new Map<number, number>();
    for (const c of ((coverage.data as { cells?: { subject_id: string; year: number; published: number; draft: number }[] } | null)?.cells ?? [])) {
      if (c.subject_id === subjectId) bank.set(c.year, c.published + c.draft);
    }
    const staged = new Map<string, StagedInfo>((papers.data ?? []).map((p) => [p.provider_year, { status: p.status, fetched: p.fetched_total }]));
    return { ok: true, provider, rows: yearRows(catalogue.entries.map((e) => String(e.value)), bank, staged) };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// Fetch -----------------------------------------------------------------------

/**
 * Fetches every page of one paper and stores each page as it arrives. A paper that was
 * interrupted resumes from the pages already stored, so nothing is paid for twice.
 */
export async function fetchPaperAction(input: PaperInput): Promise<Outcome<{ result: FetchResult }>> {
  if (!(await isAdmin())) return { ok: false, error: "Sign in again." };
  const ref = clean(input);
  if (!ref) return { ok: false, error: "Pick an exam, year and subject." };
  const db = adminDb();
  const key = paperKey(ref);
  const year = /^\d{4}$/.test(String(ref.exam_year_id)) ? Number(ref.exam_year_id) : null;

  const { data: paper, error: paperError } = await db
    .from("import_papers")
    .upsert(
      {
        paper_key: key,
        provider_exam: ref.exam,
        provider_year: String(ref.exam_year_id),
        provider_subject: ref.subject,
        subject_id: MYQUEST_SUBJECTS[ref.subject] ?? null,
        year,
        status: "fetching",
        adapter_version: ADAPTER,
      },
      { onConflict: "paper_key" },
    )
    .select("id")
    .single();
  if (paperError || !paper) return { ok: false, error: "Couldn't start the fetch. Nothing was charged." };

  const { data: stored } = await db.from("import_pages").select("page, body_hash, raw").eq("paper_id", paper.id);
  const saved = new Map<number, FetchedPage>();
  for (const s of stored ?? []) {
    const text = JSON.stringify(s.raw);
    saved.set(s.page, { page: s.page, raw: { status: 200, text, json: s.raw, hash: s.body_hash }, parsed: parsePage(s.raw) });
  }

  let charged = 0;
  let balance: string | null = null;
  try {
    const out = await fetchPaper(client(), ref, {
      have: (page) => saved.get(page),
      onPage: async (p) => {
        const { error } = await db.from("import_pages").upsert({ paper_id: paper.id, page: p.page, body_hash: p.raw.hash, received: p.parsed.rows.length, raw: p.raw.json }, { onConflict: "paper_id,page" });
        if (error) throw new Error("save_failed");
        const meta = p.raw.json as { charges?: string; new_balance?: string };
        const n = Number(String(meta.charges ?? "").replace(/[^0-9.]/g, ""));
        if (Number.isFinite(n)) charged += n;
        if (meta.new_balance) balance = meta.new_balance;
      },
    });
    const rec = out.reconciliation;
    const first = out.pages[0]?.parsed;
    await db
      .from("import_papers")
      .update({
        status: rec.complete ? "complete" : "incomplete",
        issues: rec.issues,
        reported_total: first?.total ?? null,
        reported_pages: first?.totalPages ?? null,
        fetched_total: rec.fetched,
      })
      .eq("id", paper.id);
    return {
      ok: true,
      result: {
        paperKey: key,
        pages: out.pages.length,
        rows: rec.fetched,
        complete: rec.complete,
        problems: rec.issues.map((i) => describeIssue(i as { code: string })),
        charged: charged > 0 ? `₦${charged.toLocaleString()}` : null,
        balance,
      },
    };
  } catch (e) {
    // Pages already stored stay stored, so the next try picks up where this one stopped.
    await db.from("import_papers").update({ status: "incomplete" }).eq("id", paper.id);
    return { ok: false, error: e instanceof MyQuestError ? friendly(e) : "A page couldn't be saved. Try again; saved pages won't be fetched again." };
  }
}

// Dry run ---------------------------------------------------------------------

/** Reads the stored pages and shows what would be imported. Changes nothing. */
export async function dryRunAction(input: PaperInput): Promise<Outcome<{ result: DryRunResult }>> {
  if (!(await isAdmin())) return { ok: false, error: "Sign in again." };
  const ref = clean(input);
  if (!ref) return { ok: false, error: "Pick an exam, year and subject." };
  const db = adminDb();
  const { data: paper } = await db.from("import_papers").select("id, status").eq("paper_key", paperKey(ref)).maybeSingle();
  if (!paper) return { ok: false, error: "This paper hasn't been fetched yet." };
  if (paper.status !== "complete") return { ok: false, error: "This paper doesn't add up yet, so it can't be checked. Fetch it again first." };

  const { data: pages } = await db.from("import_pages").select("page, raw").eq("paper_id", paper.id).order("page");
  const rows = (pages ?? []).flatMap((p) => parsePage(p.raw).rows);
  const { questions, report } = normalisePaper(ref, rows);

  const text = (blocks: { type: string; content?: { text?: string; math?: string }[] }[]) =>
    blocks
      .flatMap((b) => (b.content ?? []).map((c) => c.text ?? c.math ?? ""))
      .join("")
      .slice(0, 140);

  return {
    ok: true,
    result: {
      report: { ...report, keyCounts: { ...report.keyCounts } },
      rows: questions.map((q) => ({ providerId: q.providerId, status: q.status, reasons: q.reasons, stem: text(q.stem as never), key: q.correctOption })),
    },
  };
}
