/**
 * Decides whether a fetched paper is complete. Pure, so every failure the first importer
 * hit (silently dropped pages, repeated pages, ids that restart) can be tested without a network.
 */

export interface PageRecord {
  /** The page number we asked for. */
  requested: number;
  /** The page number the provider says it returned, when it says. */
  reported: number | null;
  /** Hash of the raw response body. Two pages with one hash means a repeat. */
  hash: string;
  /** Provider ids of the questions on this page. */
  ids: (string | number)[];
}

export interface PaperExpectation {
  /** Total rows the provider advertised on page one, when it did. */
  total: number | null;
  /** Total pages the provider advertised, when it did. */
  totalPages: number | null;
}

export type ReconcileIssue =
  | { code: "no_pages" }
  | { code: "empty_page"; page: number }
  | { code: "page_gap"; missing: number[] }
  | { code: "page_number_mismatch"; page: number; reported: number }
  | { code: "repeated_page"; pages: number[] }
  | { code: "duplicate_ids"; ids: (string | number)[] }
  | { code: "missing_id"; page: number }
  | { code: "total_mismatch"; expected: number; fetched: number }
  | { code: "page_count_mismatch"; expected: number; fetched: number }
  | { code: "no_total_reported" };

export interface Reconciliation {
  complete: boolean;
  fetched: number;
  issues: ReconcileIssue[];
}

export function reconcilePaper(expect: PaperExpectation, pages: PageRecord[]): Reconciliation {
  const issues: ReconcileIssue[] = [];
  if (pages.length === 0) {
    return { complete: false, fetched: 0, issues: [{ code: "no_pages" }] };
  }

  const requested = pages.map((p) => p.requested).sort((a, b) => a - b);
  const last = requested[requested.length - 1];
  const missing: number[] = [];
  for (let n = 1; n <= last; n++) if (!requested.includes(n)) missing.push(n);
  if (missing.length) issues.push({ code: "page_gap", missing });

  const byHash = new Map<string, number[]>();
  for (const p of pages) {
    byHash.set(p.hash, [...(byHash.get(p.hash) ?? []), p.requested]);
    if (p.ids.length === 0) issues.push({ code: "empty_page", page: p.requested });
    if (p.reported !== null && p.reported !== p.requested) {
      issues.push({ code: "page_number_mismatch", page: p.requested, reported: p.reported });
    }
  }
  for (const group of byHash.values()) {
    if (group.length > 1) issues.push({ code: "repeated_page", pages: group });
  }

  // Provider ids restart per paper, so uniqueness is checked inside one paper only.
  const seen = new Set<string>();
  const dupes = new Set<string | number>();
  let fetched = 0;
  for (const p of pages) {
    for (const id of p.ids) {
      fetched++;
      if (id === null || id === undefined || id === "") {
        issues.push({ code: "missing_id", page: p.requested });
        continue;
      }
      const key = String(id);
      if (seen.has(key)) dupes.add(id);
      seen.add(key);
    }
  }
  if (dupes.size) issues.push({ code: "duplicate_ids", ids: [...dupes] });

  if (expect.total === null) {
    issues.push({ code: "no_total_reported" });
  } else if (fetched !== expect.total) {
    issues.push({ code: "total_mismatch", expected: expect.total, fetched });
  }
  if (expect.totalPages !== null && pages.length !== expect.totalPages) {
    issues.push({ code: "page_count_mismatch", expected: expect.totalPages, fetched: pages.length });
  }

  return { complete: issues.length === 0, fetched, issues };
}
