// Runs the question import from the command line, so Claude Code can do the AI step itself.
// Same code and same checks as the admin import page (lib/myquest/enrich/server.ts).
//
//   npm run ai:import -- stage   --year 2001 --subject Physics            load a fetched paper into the database
//   npm run ai:import -- prompt  --year 2001 --subject Physics --out FILE  write the prompt (and list any figures)
//   npm run ai:import -- check   --year 2001 --subject Physics --reply FILE [--model NAME]
//   npm run ai:import -- publish --year 2001 --subject Physics [--accept-ai ID,ID]
//   npm run ai:import -- undo    --batch BATCH_ID
//
// Fetch first with: npm run mq:fetch -- paper --exam JAMB --year 2001 --subject Physics (this is the step that costs money).
// Single batch: every paper is one prompt (BATCH_SIZE is 1000), so the batch number is always 1.
import fs from "node:fs";
import { createClient as createDb } from "@supabase/supabase-js";
import { createClient, fetchPaper, paperKey, parsePage, sha256 } from "../lib/myquest/client.ts";
import { buildPrompt } from "../lib/myquest/enrich/prompt.ts";
import { checkReplyWith, loadPaperWith, publishBatchWith } from "../lib/myquest/enrich/server.ts";
import { checkBatch } from "../lib/myquest/enrich/check.ts";
import { parseReply } from "../lib/myquest/enrich/parse.ts";
import { subjectForProvider } from "../lib/myquest/subjects.ts";

// Where the AI wins a disagreement with the provider's answer key: subjects whose answers can be worked out and shown.
// Everything else (book questions, recall subjects) keeps the provider's key, and a disagreement stays blocked for a person.
// The set text and Literature never reach here: their key is the answer already (usesSourceKey).
const AI_WINS = new Set(["physics", "mathematics", "chemistry", "accounting"]);

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const db = createDb(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const input = { exam: flag("exam") ?? "JAMB", year: flag("year"), subject: flag("subject") };
const die = (m) => {
  console.error(m);
  process.exit(1);
};
const needPaper = () => {
  if (!input.year || !input.subject) die("needs --year and --subject (the subject as MyQuest names it, for example Physics or \"Use of English\")");
};

async function stage() {
  needPaper();
  const ref = { exam: input.exam, exam_year_id: input.year, subject: input.subject };
  const dir = `data/imports/myquest/papers/${paperKey(ref).replace(/[^A-Za-z0-9_.-]/g, "_")}`;
  if (!fs.existsSync(`${dir}/page-1.json`)) die(`Nothing fetched for this paper yet (looked in ${dir}). Fetch it first.`);
  const { data: paper, error } = await db
    .from("import_papers")
    .upsert(
      { paper_key: paperKey(ref), provider_exam: ref.exam, provider_year: String(ref.exam_year_id), provider_subject: ref.subject, subject_id: subjectForProvider(ref.subject), year: /^\d{4}$/.test(ref.exam_year_id) ? Number(ref.exam_year_id) : null, status: "fetching", adapter_version: "mq-1" },
      { onConflict: "paper_key" },
    )
    .select("id")
    .single();
  if (error || !paper) die(`Could not create the paper: ${error?.message}`);
  // The client has no key, so a missing page fails here instead of being fetched and charged.
  const out = await fetchPaper(createClient({ apiKey: undefined }), ref, {
    have: (page) => {
      const file = `${dir}/page-${page}.json`;
      if (!fs.existsSync(file)) return undefined;
      const text = fs.readFileSync(file, "utf8");
      return { page, raw: { status: 200, text, json: JSON.parse(text), hash: sha256(text) }, parsed: parsePage(JSON.parse(text)) };
    },
  });
  for (const p of out.pages) {
    const { error: e } = await db.from("import_pages").upsert({ paper_id: paper.id, page: p.page, body_hash: p.raw.hash, received: p.parsed.rows.length, raw: p.raw.json }, { onConflict: "paper_id,page" });
    if (e) die(`Could not save page ${p.page}: ${e.message}`);
  }
  const rec = out.reconciliation;
  const first = out.pages[0]?.parsed;
  await db.from("import_papers").update({ status: rec.complete ? "complete" : "incomplete", issues: rec.issues, reported_total: first?.total ?? null, reported_pages: first?.totalPages ?? null, fetched_total: rec.fetched }).eq("id", paper.id);
  console.log(`${paperKey(ref)}: ${rec.fetched} rows over ${out.pages.length} page(s), ${rec.complete ? "complete" : "INCOMPLETE " + JSON.stringify(rec.issues)}`);
}

async function load() {
  needPaper();
  const l = await loadPaperWith(db, input);
  if (!l.ok) die(l.error);
  return l.data;
}

async function prompt() {
  const l = await load();
  const out = flag("out");
  if (!out) die("needs --out FILE");
  const batch = l.batches[0];
  if (!batch) die("This paper has no usable questions.");
  fs.writeFileSync(out, buildPrompt({ subjectId: l.subjectId, subjectName: l.subjectName, batchNo: 1, batches: l.batches.length, topics: l.topics, batch, sourceKey: l.sourceKey }));
  const held = batch.filter((b) => b.question.status !== "ready").length;
  console.log(`${batch.length} questions, ${l.topics.length} topics, prompt written to ${out}`);
  if (held) console.log(`${held} questions carry importer notes (see "Content notes" in the prompt)`);
  for (const b of batch.filter((x) => x.figure && x.question.remoteImage)) console.log(`figure ${b.figure} (${b.id}): ${b.question.remoteImage}`);
}

async function check() {
  needPaper();
  const file = flag("reply");
  if (!file) die("needs --reply FILE");
  const r = await checkReplyWith(db, input, 1, fs.readFileSync(file, "utf8"), flag("model") ?? "claude-code");
  if (!r.ok) die(r.error);
  const { result } = r;
  if (result.error) die(`The reply could not be read: ${result.error}`);
  const qs = result.questions;
  console.log(`${qs.length} questions checked, ${qs.filter((q) => q.publishable).length} publishable`);
  if (result.truncated) console.log("WARNING: the reply looks cut off");
  for (const w of result.warnings) console.log(`warning: ${w}`);
  if (result.unknownIds.length) console.log(`ids not in this paper: ${result.unknownIds.join(", ")}`);
  for (const q of qs) {
    if (q.publishable && !q.flags.length) continue;
    console.log(`  ${q.id} (position ${q.position}) ${q.publishable ? "ok with notes" : "BLOCKED"}: ${q.flags.map((f) => `${f.code}${f.severity === "block" ? "!" : ""}`).join(", ")}`);
  }
}

async function publish() {
  needPaper();
  const accept = (flag("accept-ai") ?? "").split(",").filter(Boolean);
  const l = await load();
  if (AI_WINS.has(l.subjectId) && !l.sourceKey) {
    const { data: saved } = await db.from("import_batch_replies").select("reply").eq("paper_id", l.paperId).eq("batch_no", 1).maybeSingle();
    const parsed = saved ? parseReply(saved.reply) : null;
    if (parsed && !parsed.error) {
      const { questions } = checkBatch(l.subjectId, l.batches[0], parsed.items, l.topics, { sourceKey: l.sourceKey });
      for (const q of questions) {
        if (q.flags.some((f) => f.code === "key_disputed") && !accept.includes(q.id)) {
          accept.push(q.id);
          console.log(`AI answer kept over the provider key: position ${q.position} (${q.id})`);
        }
      }
    }
  }
  const r = await publishBatchWith(db, input, 1, accept);
  if (!r.ok) die(r.error);
  console.log(`published ${r.result.published}${r.result.batchId ? ` (undo with: npm run ai:import -- undo --batch ${r.result.batchId})` : ""}`);
  for (const n of r.result.notPublished) console.log(`  not published: position ${n.position}, ${n.reason}`);
}

async function undo() {
  const batch = flag("batch");
  if (!batch || !/^[0-9a-f-]{36}$/.test(batch)) die("needs --batch BATCH_ID");
  const { data, error } = await db.rpc("import_undo", { p_batch: batch });
  if (error || !data) die(`Could not undo: ${error?.message}`);
  console.log(`undone: ${data.deleted} removed, ${data.retired} retired`);
}

const commands = { stage, prompt, check, publish, undo };
if (!commands[cmd]) die(`usage: ai:import -- ${Object.keys(commands).join(" | ")}`);
await commands[cmd]();
