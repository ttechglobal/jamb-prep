import test from "node:test";
import assert from "node:assert/strict";
import { createClient, fetchPaper, parseCatalogue, parsePage, paperKey, sourceRef, MyQuestError } from "../lib/myquest/client.ts";
import { reconcilePaper } from "../lib/myquest/reconcile.ts";

const row = (id) => ({ id, question: `Q${id}`, options: { A: "a", B: "b", C: "c", D: "d" }, correct_answer: "A", explanation: "x" });
const page = (n, ids, total, totalPages) =>
  JSON.stringify({ questions: ids.map(row), pagination: { total, per_page: 40, current_page: n, total_pages: totalPages }, message: null });

const res = (body, status = 200, headers = {}) => new Response(body, { status, headers });
const fast = { apiKey: "k", sleep: async () => {}, baseDelayMs: 1 };
const REF = { exam: "JAMB", exam_year_id: "2025", subject: "Use of English" };

test("parsePage reads the decoded shape, a nested envelope and a JSON-encoded array", () => {
  assert.equal(parsePage(JSON.parse(page(1, [1, 2], 2, 1))).rows.length, 2);
  const nested = { success: true, data: { questions: [row(1)], pagination: { total: 1, total_pages: 1, current_page: 1 } } };
  assert.equal(parsePage(nested).total, 1);
  assert.equal(parsePage({ questions: JSON.stringify([row(1), row(2)]) }).rows.length, 2);
  assert.throws(() => parsePage({ questions: "not json" }), MyQuestError);
  assert.throws(() => parsePage({ message: "nothing" }), MyQuestError);
});

test("parseCatalogue keeps provider values exactly and deduplicates", () => {
  const out = parseCatalogue("exam_year_id", { success: true, data: [{ exam_year_id: "0045", year: "2025" }, { exam_year_id: "0045", year: "2025" }, 2024] });
  assert.deepEqual(out.map((e) => e.value), ["0045", 2024]);
  assert.equal(out[0].label, "2025");
  assert.deepEqual(parseCatalogue("subject", { data: ["The Lekki Headmaster", { name: "Use of English" }] }).map((e) => e.value), ["The Lekki Headmaster", "Use of English"]);
});

test("source refs include the paper, so ids restarting at 1 never collide", () => {
  const other = { ...REF, subject: "Literature" };
  assert.notEqual(sourceRef(REF, 1), sourceRef(other, 1));
  assert.equal(paperKey(REF), "mq:JAMB:2025:Use_of_English");
});

test("a complete three-page paper reconciles", async () => {
  const bodies = [page(1, [1, 2], 5, 3), page(2, [3, 4], 5, 3), page(3, [5], 5, 3)];
  let n = 0;
  const client = createClient({ ...fast, fetchImpl: async () => res(bodies[n++]) });
  const out = await fetchPaper(client, REF);
  assert.equal(out.reconciliation.complete, true);
  assert.equal(out.reconciliation.fetched, 5);
});

test("the first importer's bug: stopping after page one is caught", () => {
  const r = reconcilePaper({ total: 80, totalPages: 2 }, [{ requested: 1, reported: 1, hash: "a", ids: Array.from({ length: 40 }, (_, i) => i + 1) }]);
  assert.equal(r.complete, false);
  assert.ok(r.issues.some((i) => i.code === "total_mismatch"));
  assert.ok(r.issues.some((i) => i.code === "page_count_mismatch"));
});

test("a repeated page, a page gap and a wrong page number are flagged", () => {
  const dup = reconcilePaper({ total: 4, totalPages: 2 }, [
    { requested: 1, reported: 1, hash: "same", ids: [1, 2] },
    { requested: 2, reported: 1, hash: "same", ids: [1, 2] },
  ]);
  const codes = dup.issues.map((i) => i.code);
  assert.ok(codes.includes("repeated_page") && codes.includes("duplicate_ids") && codes.includes("page_number_mismatch"));
  const gap = reconcilePaper({ total: 2, totalPages: 3 }, [
    { requested: 1, reported: 1, hash: "a", ids: [1] },
    { requested: 3, reported: 3, hash: "b", ids: [2] },
  ]);
  assert.deepEqual(gap.issues.find((i) => i.code === "page_gap").missing, [2]);
});

test("no advertised total means incomplete, never a guess", () => {
  const r = reconcilePaper({ total: null, totalPages: null }, [{ requested: 1, reported: null, hash: "a", ids: [1] }]);
  assert.equal(r.complete, false);
  assert.equal(r.issues[0].code, "no_total_reported");
});

test("429 honours Retry-After, then succeeds", async () => {
  const waits = [];
  let n = 0;
  const client = createClient({
    apiKey: "k",
    baseDelayMs: 1,
    sleep: async (ms) => void waits.push(ms),
    fetchImpl: async () => (n++ === 0 ? res("{}", 429, { "retry-after": "7" }) : res(page(1, [1], 1, 1))),
  });
  const out = await fetchPaper(client, REF);
  assert.equal(out.reconciliation.complete, true);
  assert.ok(waits[0] >= 7000);
});

test("5xx and network failures retry, then give up after the cap", async () => {
  let calls = 0;
  const client = createClient({ ...fast, maxAttempts: 3, fetchImpl: async () => (calls++, res("oops", 503)) });
  await assert.rejects(fetchPaper(client, REF), (e) => e.kind === "upstream");
  assert.equal(calls, 3);
  calls = 0;
  const net = createClient({ ...fast, maxAttempts: 2, fetchImpl: async () => { calls++; throw new TypeError("fetch failed"); } });
  await assert.rejects(fetchPaper(net, REF), (e) => e.kind === "network");
  assert.equal(calls, 2);
});

test("auth failure and bad JSON do not retry", async () => {
  let calls = 0;
  const auth = createClient({ ...fast, fetchImpl: async () => (calls++, res("{}", 401)) });
  await assert.rejects(fetchPaper(auth, REF), (e) => e.kind === "auth");
  assert.equal(calls, 1);
  calls = 0;
  const bad = createClient({ ...fast, fetchImpl: async () => (calls++, res("<html>")) });
  await assert.rejects(fetchPaper(bad, REF), (e) => e.kind === "bad_json");
  assert.equal(calls, 1);
});

test("a missing key is a config error before any request", async () => {
  let called = false;
  const client = createClient({ apiKey: undefined, fetchImpl: async () => { called = true; return res("{}"); } });
  await assert.rejects(fetchPaper(client, REF), (e) => e.kind === "config");
  assert.equal(called, false);
});

test("a resumed run reuses stored pages and requests only the rest", async () => {
  const stored = new Map();
  const bodies = { 1: page(1, [1, 2], 3, 2), 2: page(2, [3], 3, 2) };
  const first = createClient({ ...fast, fetchImpl: async (_u, init) => res(bodies[JSON.parse(init.body).page]) });
  await fetchPaper(first, { ...REF }, { onPage: (p) => void stored.set(p.page, p) });
  const asked = [];
  const second = createClient({ ...fast, fetchImpl: async (_u, init) => (asked.push(JSON.parse(init.body).page), res(bodies[JSON.parse(init.body).page])) });
  stored.delete(2);
  const out = await fetchPaper(second, REF, { have: (n) => stored.get(n) });
  assert.deepEqual(asked, [2]);
  assert.equal(out.reconciliation.complete, true);
});

test("the year id is sent exactly as the catalogue gave it", async () => {
  let body;
  const client = createClient({ ...fast, fetchImpl: async (_u, init) => (body = JSON.parse(init.body), res(page(1, [1], 1, 1))) });
  await fetchPaper(client, { ...REF, exam_year_id: "0045" });
  assert.equal(body.exam_year_id, "0045");
});
