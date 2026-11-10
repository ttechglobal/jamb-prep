/**
 * MyQuest API client. Server and script use only: the key must never reach a browser.
 * The wire format has only been seen through the first app's code and decoded captures,
 * so parsing is tolerant, and every response is kept raw so nothing is lost if we guessed wrong.
 */
import { createHash } from "node:crypto";
import { reconcilePaper, type PageRecord, type Reconciliation } from "./reconcile.ts";

export const MYQUEST_URL = "https://api.myquest.com.ng/api";

export type MyQuestErrorKind = "config" | "auth" | "rate_limited" | "upstream" | "network" | "bad_json" | "bad_shape";

export class MyQuestError extends Error {
  kind: MyQuestErrorKind;
  status?: number;
  retryAfterMs?: number;
  constructor(kind: MyQuestErrorKind, message: string, extra: { status?: number; retryAfterMs?: number } = {}) {
    super(message);
    this.kind = kind;
    this.status = extra.status;
    this.retryAfterMs = extra.retryAfterMs;
  }
  /** Worth another attempt. Auth, shape and config problems are not. */
  get retryable() {
    return this.kind === "network" || this.kind === "rate_limited" || this.kind === "upstream";
  }
}

export interface ClientOptions {
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  url?: string;
}

export interface RawResponse {
  status: number;
  text: string;
  json: unknown;
  hash: string;
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function retryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export function createClient(options: ClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 1_000;
  const url = options.url ?? MYQUEST_URL;

  async function once(query: string, body: unknown): Promise<RawResponse> {
    if (!options.apiKey) throw new MyQuestError("config", "MYQUEST_API_KEY is missing");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${url}${query}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      throw new MyQuestError("network", e instanceof Error ? e.message : "network error");
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new MyQuestError("auth", "MyQuest rejected the key", { status: res.status });
    if (res.status === 429) {
      throw new MyQuestError("rate_limited", "MyQuest rate limit", { status: 429, retryAfterMs: retryAfter(res.headers.get("retry-after")) });
    }
    if (res.status >= 500) throw new MyQuestError("upstream", `MyQuest returned ${res.status}`, { status: res.status });
    if (!res.ok) throw new MyQuestError("bad_shape", `MyQuest returned ${res.status}`, { status: res.status });
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new MyQuestError("bad_json", "MyQuest response was not JSON", { status: res.status });
    }
    return { status: res.status, text, json, hash: sha256(text) };
  }

  /** Retries network, 429 and 5xx with backoff and jitter, honouring Retry-After. */
  async function post(query: string, body: unknown): Promise<RawResponse> {
    let last: MyQuestError | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await once(query, body);
      } catch (e) {
        if (!(e instanceof MyQuestError)) throw e;
        last = e;
        if (!e.retryable || attempt === maxAttempts) throw e;
        const backoff = baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random() / 2);
        await sleep(Math.max(e.retryAfterMs ?? 0, backoff));
      }
    }
    throw last!;
  }

  return { post };
}

export type MyQuestClient = ReturnType<typeof createClient>;

// Catalogue ------------------------------------------------------------------

export type CatalogueKind = "exam" | "exam_year_id" | "subject";

export interface CatalogueEntry {
  /** Exactly what the provider wants back in the next request. */
  value: string | number;
  label: string;
  raw: unknown;
}

const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== "") return o[k] as string | number;
  return undefined;
};

/** Accepts the shapes the first app handled: strings, numbers, or objects with a name/id field. */
export function parseCatalogue(kind: CatalogueKind, json: unknown): CatalogueEntry[] {
  const root = json as Record<string, unknown> | null;
  const data = root && typeof root === "object" && "data" in root ? root.data : json;
  if (!Array.isArray(data)) throw new MyQuestError("bad_shape", `catalogue ${kind} had no data array`);
  const valueKeys = kind === "exam" ? ["exam", "name", "code"] : kind === "exam_year_id" ? ["exam_year_id", "id", "year"] : ["subject", "name", "title"];
  const labelKeys = kind === "exam_year_id" ? ["year", "name", "exam_year_id", "id"] : valueKeys;
  const seen = new Set<string>();
  const out: CatalogueEntry[] = [];
  for (const item of data) {
    let value: string | number | undefined;
    let label: string | number | undefined;
    if (typeof item === "string" || typeof item === "number") {
      value = item;
      label = item;
    } else if (item && typeof item === "object") {
      value = pick(item as Record<string, unknown>, valueKeys);
      label = pick(item as Record<string, unknown>, labelKeys) ?? value;
    }
    if (value === undefined || seen.has(String(value))) continue;
    seen.add(String(value));
    out.push({ value, label: String(label), raw: item });
  }
  return out;
}

export async function fetchCatalogue(
  client: MyQuestClient,
  kind: CatalogueKind,
  parent: { exam?: string; exam_year_id?: string | number } = {},
) {
  const body: Record<string, unknown> = {};
  if (parent.exam !== undefined) body.exam = parent.exam;
  // The year id is sent exactly as the catalogue gave it. The first app turned "2025" into 2025
  // in one call and a string in another, and leading zeroes would be lost.
  if (parent.exam_year_id !== undefined) body.exam_year_id = parent.exam_year_id;
  const raw = await client.post(`/questions?get=${kind}`, body);
  return { raw, entries: parseCatalogue(kind, raw.json) };
}

// Questions ------------------------------------------------------------------

export interface PaperRef {
  exam: string;
  exam_year_id: string | number;
  subject: string;
}

export const paperKey = (p: PaperRef) => `mq:${p.exam}:${p.exam_year_id}:${p.subject}`.replace(/\s+/g, "_");
/** Provider ids restart per paper, so a question is only identified together with its paper. */
export const sourceRef = (p: PaperRef, id: string | number) => `${paperKey(p)}:${id}`;

export interface ParsedPage {
  rows: Record<string, unknown>[];
  total: number | null;
  totalPages: number | null;
  currentPage: number | null;
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Accepts the decoded shape (top level) or one nested under `data`, and a JSON-encoded rows array. */
export function parsePage(json: unknown): ParsedPage {
  const root = json as Record<string, unknown> | null;
  if (!root || typeof root !== "object") throw new MyQuestError("bad_shape", "page was not an object");
  const holder = (root.questions === undefined && root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  let rows = holder.questions;
  if (typeof rows === "string") {
    try {
      rows = JSON.parse(rows);
    } catch {
      throw new MyQuestError("bad_json", "questions field was not valid JSON");
    }
  }
  if (!Array.isArray(rows)) throw new MyQuestError("bad_shape", "page had no questions array");
  const pg = (holder.pagination ?? root.pagination ?? {}) as Record<string, unknown>;
  return {
    rows: rows as Record<string, unknown>[],
    total: num(pg.total),
    totalPages: num(pg.total_pages),
    currentPage: num(pg.current_page),
  };
}

export interface FetchedPage {
  page: number;
  raw: RawResponse;
  parsed: ParsedPage;
}

export interface PaperFetch {
  ref: PaperRef;
  key: string;
  pages: FetchedPage[];
  reconciliation: Reconciliation;
}

const MAX_PAGES = 200;

/**
 * Walks every page of one paper. `onPage` runs before the next request, so a caller can store
 * each page before moving on. `have` lets a resumed run skip pages already stored.
 */
export async function fetchPaper(
  client: MyQuestClient,
  ref: PaperRef,
  hooks: {
    onPage?: (p: FetchedPage) => Promise<void> | void;
    have?: (page: number) => FetchedPage | undefined;
  } = {},
): Promise<PaperFetch> {
  const pages: FetchedPage[] = [];
  let totalPages: number | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    let fetched = hooks.have?.(page);
    if (!fetched) {
      const raw = await client.post("/questions", { ...ref, page });
      fetched = { page, raw, parsed: parsePage(raw.json) };
      await hooks.onPage?.(fetched);
    }
    pages.push(fetched);
    if (page === 1) totalPages = fetched.parsed.totalPages;
    // Stop on the advertised last page. With no pagination at all there is nothing to walk,
    // so stop and let reconcile flag the missing total instead of guessing.
    if (totalPages !== null) {
      if (page >= totalPages) break;
    } else {
      break;
    }
  }
  const records: PageRecord[] = pages.map((p) => ({
    requested: p.page,
    reported: p.parsed.currentPage,
    hash: p.raw.hash,
    ids: p.parsed.rows.map((r) => r.id as string | number),
  }));
  const first = pages[0]?.parsed;
  const reconciliation = reconcilePaper({ total: first?.total ?? null, totalPages: first?.totalPages ?? null }, records);
  return { ref, key: paperKey(ref), pages, reconciliation };
}
