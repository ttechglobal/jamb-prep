// Imports the audited Exam Prep A1 export into the question bank.
//
//   npm run db:import            dry run: converts everything, writes a report, touches nothing
//   npm run db:import -- --apply loads the questions in one transaction
//
// Reads data/imports/ (gitignored). The audit decides which rows are left out:
// data/imports/audit/hold-list.json and duplicates-dropped.json.
import { createHash } from "node:crypto";
import fs from "node:fs";
import katex from "katex";
import postgres from "postgres";
import { validateQuestion } from "../lib/content/validate.ts";

const DIR = "data/imports";
const APPLY = process.argv.includes("--apply");
const KEYS = ["A", "B", "C", "D"];

const SUBJECTS = {
  Accounting: "accounting",
  Biology: "biology",
  Chemistry: "chemistry",
  Commerce: "commerce",
  CRK: "crk",
  Economics: "economics",
  "English Language": "english",
  Government: "government",
  "Literature in English": "literature",
  Mathematics: "mathematics",
  Physics: "physics",
};
const MONEY_SUBJECTS = new Set(["accounting", "commerce", "economics", "mathematics"]);
const CHEMICAL_SUBJECTS = new Set(["chemistry", "biology"]);

// Inline content ------------------------------------------------------------

const ELEMENTS = new Set(
  "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Ag Cd Sn Sb I Xe Cs Ba Pt Au Hg Pb Bi U".split(" "),
);
const SINGLE_ELEMENT_MOLECULES = new Set(["H2", "O2", "O3", "N2", "F2", "Cl2", "Br2", "I2", "S8", "P4"]);

/** KMnO4 becomes KMnO + subscript 4. Returns null if the token is not a chemical formula. */
function chemicalParts(token) {
  const lead = token.match(/^\d*/)[0];
  const body = token.slice(lead.length);
  const parts = [];
  let i = 0;
  let elements = 0;
  let digits = 0;
  while (i < body.length) {
    const two = body.slice(i, i + 2);
    const one = body[i];
    if (one === "(" || one === ")") {
      parts.push({ text: one });
      i += 1;
    } else if (/^[A-Z][a-z]$/.test(two) && ELEMENTS.has(two)) {
      parts.push({ text: two });
      i += 2;
      elements += 1;
    } else if (ELEMENTS.has(one)) {
      parts.push({ text: one });
      i += 1;
      elements += 1;
    } else if (/\d/.test(one)) {
      const run = body.slice(i).match(/^\d+/)[0];
      if (parts.length === 0) return null;
      parts.push({ text: run, marks: ["subscript"] });
      i += run.length;
      digits += 1;
    } else return null;
  }
  if (digits === 0) return null;
  if (elements < 2 && !SINGLE_ELEMENT_MOLECULES.has(body)) return null;
  return lead ? [{ text: lead }, ...parts] : parts;
}

function withChemistry(run) {
  const out = [];
  const re = /(?<![A-Za-z0-9])[A-Z0-9(][A-Za-z0-9()]*[A-Za-z0-9)](?![A-Za-z0-9+\-⁺⁻])/g;
  let last = 0;
  for (const m of run.text.matchAll(re)) {
    const parts = chemicalParts(m[0]);
    if (!parts) continue;
    if (m.index > last) out.push({ ...run, text: run.text.slice(last, m.index) });
    for (const p of parts) out.push({ text: p.text, marks: [...(run.marks ?? []), ...(p.marks ?? [])] });
    last = m.index + m[0].length;
  }
  if (last < run.text.length) out.push({ ...run, text: run.text.slice(last) });
  return out;
}

function withScripts(run) {
  const out = [];
  const re = /\^(\{[^}]+\}|\([^()]*\)|[-+−]?\d+(?:\.\d+)?|[-+−]?[A-Za-z])|(?<=[A-Za-z])_(\d+|[A-Za-z][A-Za-z0-9₀-₉]*)/g;
  let last = 0;
  for (const m of run.text.matchAll(re)) {
    if (m.index > last) out.push({ ...run, text: run.text.slice(last, m.index) });
    const value = (m[1] ?? m[2]).replace(/^[{(]|[})]$/g, "");
    out.push({ text: value, marks: [...(run.marks ?? []), m[1] ? "superscript" : "subscript"] });
    last = m.index + m[0].length;
  }
  if (last < run.text.length) out.push({ ...run, text: run.text.slice(last) });
  return out;
}

function normaliseWords(value, subject) {
  let t = value;
  if (MONEY_SUBJECTS.has(subject)) {
    t = t
      .replace(/(?<![A-Za-z0-9.])[N#]\s?(?=\d)/g, "₦")
      .replace(/\(N\)/g, "(₦)")
      .replace(/₦(\d[\d,.]*)\s?\/-/g, "₦$1");
  }
  t = t.replace(/<=/g, "≤").replace(/>=/g, "≥").replace(/!=/g, "≠").replace(/\bsqrt\s?\(/g, "√(");
  // In a defined operation such as a * b = ab, the star is the operation's own symbol.
  if (!/binary|operation|\b[a-z]\s?\*\s?[a-z]\s?=/i.test(t)) t = t.replace(/(?<=[\w)])\s?\*\s?(?=[\w(])/g, " × ");
  if (subject === "english") t = t.replace(/(^|\s)\.{3,}(?=\s|$|[,.?!])/g, "$1_____").replace(/_{3,}/g, "_____");
  return t;
}

function plainRuns(value, subject, marks = []) {
  const base = marks.length ? { text: normaliseWords(value, subject), marks } : { text: normaliseWords(value, subject) };
  let runs = withScripts(base);
  if (CHEMICAL_SUBJECTS.has(subject)) runs = runs.flatMap((r) => (r.marks?.length ? [r] : withChemistry(r)));
  return runs
    .filter((r) => r.text.length > 0)
    .map((r) => (r.marks?.length ? r : { text: r.text }));
}

const MATRIX = /\[\[([^\]]+)\],?\s*\[([^\]]+)\]\]/g;
const matrixTex = (a, b) => {
  const row = (r) => r.trim().split(/[\s,]+/).join(" & ");
  return `\\begin{bmatrix} ${row(a)} \\\\ ${row(b)} \\end{bmatrix}`;
};

/** Question and option text: never treats $ as a formula, because ₦/$ rates appear in stems. */
function textInline(value, subject) {
  const out = [];
  let last = 0;
  for (const m of value.matchAll(MATRIX)) {
    if (m.index > last) out.push(...markdownRuns(value.slice(last, m.index), subject, subject === "literature"));
    out.push({ math: matrixTex(m[1], m[2]) });
    last = m.index + m[0].length;
  }
  if (last < value.length) out.push(...markdownRuns(value.slice(last), subject, subject === "literature"));
  return out;
}

function markdownRuns(value, subject, italics = true) {
  const out = [];
  const re = italics ? /\*\*(.+?)\*\*|(?<![\w*])\*([^*\n]+?)\*(?![\w*])/g : /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const m of value.matchAll(re)) {
    if (m.index > last) out.push(...plainRuns(value.slice(last, m.index), subject));
    out.push(...plainRuns(m[1] ?? m[2], subject, [m[1] ? "bold" : "italic"]));
    last = m.index + m[0].length;
  }
  if (last < value.length) out.push(...plainRuns(value.slice(last), subject));
  return out;
}

class ConversionError extends Error {}

/** Explanation text: $...$ is a formula. An unbalanced $ cannot be read safely, so it fails. */
function explanationInline(value, subject) {
  const parts = String(value).split(/(?<!\\)\$/);
  if (parts.length % 2 === 0) throw new ConversionError("unbalanced_formula");
  return parts.flatMap((part, i) => {
    if (i % 2 === 0) return part ? markdownRuns(part, subject) : [];
    const tex = part.replace(/(?<!\\)%/g, "\\%");
    try {
      katex.renderToString(tex, { throwOnError: true, strict: "ignore" });
    } catch {
      throw new ConversionError("formula_does_not_render");
    }
    return [{ math: tex }];
  });
}

const paragraph = (content) => ({ type: "paragraph", content });
const cell = (value) => [{ text: value }];

function explanationBlocks(value, subject) {
  if (!String(value ?? "").trim()) return undefined;
  return String(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const whole = line.match(/^\$([^$]+)\$$/);
      if (whole) {
        const [only] = explanationInline(line, subject);
        return { type: "math", tex: only.math };
      }
      return paragraph(explanationInline(line, subject));
    });
}

// Row conversion ------------------------------------------------------------

/** Five questions hold their data as text. Each is rebuilt by hand into a real table. */
function tableOverride(row) {
  const prefix = row.id.slice(0, 8);
  const q = row.question_text;
  if (prefix === "3984a0ba") {
    return [
      paragraph([{ text: "The frequency distribution of marks is:" }]),
      { type: "table", align: ["left", "right", "right", "right"], header: [[cell("Marks"), cell("0-9"), cell("10-19"), cell("20-29")]], rows: [[cell("Frequency"), cell("10"), cell("15"), cell("5")]] },
      paragraph([{ text: "Find the mode of the distribution." }]),
    ];
  }
  if (prefix === "435429bf") {
    return [
      { type: "table", align: ["right", "right"], header: [[cell("Price (₦)"), cell("Quantity (kg)")]], rows: [[cell("50"), cell("500")], [cell("70"), cell("400")]] },
      paragraph([{ text: "From the above, calculate the price elasticity of demand" }]),
    ];
  }
  if (prefix === "54d0c580") {
    return [
      paragraph([{ text: "In a survey, the percentage distribution of household members is:" }]),
      {
        type: "table",
        align: ["left", "right", "right", "right", "right", "right", "right", "right", "right"],
        header: [["No of members", "1", "2", "3", "4", "5", "6", "7", "Total"].map(cell)],
        rows: [["No of households", "3", "9", "15", "25", "21", "10", "7", "100"].map(cell)],
      },
      paragraph([{ text: q.slice(q.lastIndexOf(". ") + 2) }]),
    ];
  }
  if (prefix === "87d944a1") {
    return [
      paragraph([{ text: "Find the missing value in the table:" }]),
      {
        type: "table",
        align: ["left", "right", "right", "right", "right", "right", "right"],
        rows: [["x", "2", "1", "0", "1", "2", "3"].map(cell), [[{ text: "y = x" }, { text: "2", marks: ["superscript"] }, { text: " + x + 3" }], ...["9", "5", "3", "5", "9", "?"].map(cell)]],
      },
    ];
  }
  if (prefix === "a0466c6c") {
    return [
      paragraph([{ text: "The table shows values for y = -3x - 1:" }]),
      {
        type: "table",
        align: ["left", "right", "right", "right", "right", "right", "right"],
        rows: [["x", "-3", "-2", "0", "1", "2", "3"].map(cell), ["y", "8", "5", "-1", "-4", "-7", "-10"].map(cell)],
      },
      paragraph([{ text: "Where does the graph cross the x-axis?" }]),
    ];
  }
  return null;
}

const STAYS_LAST = /\b(all|none|both|neither|either)\b.{0,20}\b(above|these|options?|statements?)\b|^\s*[A-D]\s*(,|and|&|only|\bor\b)|\b[A-D] (and|&) [A-D]\b/i;
const OPTION_LETTER_IN_PROSE =
  /\b(options?|answers?|choices?)\s+[A-D]\b|\b(as|than|like|unlike|from|with|and|or|while|but|not|both|either)\s+[A-D]\b(?![-–]\d)|(?<![\w'.-]|\d |vitamin |vitamins |group |groups |type |types |grade |hepatitis |class )\b[B-D]\b(?! ?[-–] ?[A-Z\d])(?!\s?(=|\+|≈|×))/;

/** Same input, same order, so a re-import never moves an option. */
function shuffledKeys(id) {
  const hash = createHash("sha256").update(id).digest();
  const order = [...KEYS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = hash[i] % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function explanationProse(e) {
  const wrong = Object.values(e.wrong_options ?? {}).map((t) => String(t).replace(/^[A-D]\s*[—–-]\s*/, ""));
  const steps = (e.steps ?? []).flatMap((s) => [s.title, ...(s.lines ?? [])]);
  const answer = String(e.correct ?? "").replace(/^The correct answer is \*\*[A-D]\s*[—–-]\s*/, "");
  return [answer, e.intro, e.hint, e.study_tip, e.concept, ...steps, ...wrong].filter(Boolean).join(" \n ").replace(/\$[^$]*\$/g, "");
}

function convert(row, subject, topicIds, subtopicIds) {
  const instructionRaw = row.instruction_text?.trim() || null;
  let stemText = row.question_text.trim();
  if (instructionRaw && stemText.toLowerCase().startsWith(instructionRaw.toLowerCase())) {
    stemText = stemText.slice(instructionRaw.length).trim();
  }

  const raw = Object.fromEntries(KEYS.map((k) => [k, String(row.options[k]).trim()]));
  if (KEYS.every((k) => /^[A-Da-d][.)]\s/.test(raw[k]))) for (const k of KEYS) raw[k] = raw[k].replace(/^[A-Da-d][.)]\s+/, "");

  const e = row.explanation;
  if (!/^The correct answer is \*\*[A-D]\s*[—–-]\s/.test(e.correct)) throw new ConversionError("explanation_format");

  const canMove =
    !Object.values(raw).some((v) => STAYS_LAST.test(v)) &&
    !/\b(options?|answers?)\s+[A-D]\b/.test(stemText) &&
    !OPTION_LETTER_IN_PROSE.test(explanationProse(e));
  const order = canMove ? shuffledKeys(row.id) : KEYS;
  // order[new position] = old letter
  const newLetter = Object.fromEntries(order.map((old, i) => [old, KEYS[i]]));

  const options = KEYS.map((key, i) => ({ key, blocks: [paragraph(textInline(raw[order[i]], subject))] }));
  const stem = tableOverride(row) ?? [paragraph(textInline(stemText, subject))];
  const instruction = instructionRaw ? [paragraph(textInline(instructionRaw.replace(/:$/, "."), subject))] : null;

  const answer = explanationBlocks(e.correct.replace(/^The correct answer is \*\*[A-D]\s*[—–-]\s*/, "The correct answer is **"), subject);
  const solution = { answer };
  if (e.concept?.trim()) solution.concept = e.concept.trim();
  if (e.intro?.trim() && e.intro.trim() !== "Let's work through this step by step.") solution.intro = explanationBlocks(e.intro, subject);
  const formula = explanationBlocks(e.formula_box, subject);
  if (formula) solution.formula = formula;
  const variables = (e.variables_key ?? []).flatMap((v) => explanationBlocks(v, subject) ?? []);
  if (variables.length) solution.variables = variables;
  const steps = (e.steps ?? []).map((s) => ({ title: s.title, blocks: s.lines.flatMap((l) => explanationBlocks(l, subject) ?? []) }));
  if (steps.length) solution.steps = steps;
  const wrong = {};
  for (const [old, text] of Object.entries(e.wrong_options ?? {})) {
    const blocks = explanationBlocks(String(text).replace(/^[A-D]\s*[—–-]\s*/, ""), subject);
    if (blocks) wrong[newLetter[old]] = blocks;
  }
  if (Object.keys(wrong).length) solution.wrongOptions = wrong;
  const tip = explanationBlocks(e.study_tip, subject);
  if (tip) solution.studyTip = tip;
  if (e.svg_diagram) {
    solution.figures = [{ type: "figure", src: `solutions/${row.id}.svg`, alt: e.illustration_title?.trim() || "Worked diagram", width: 400, height: 300 }];
  }

  return {
    moved: canMove,
    svg: e.svg_diagram ?? null,
    question: {
      id: row.id,
      subject_id: subject,
      topic_id: topicIds.has(row.topic_id) ? row.topic_id : null,
      subtopic_id: subtopicIds.has(row.subtopic_id) ? row.subtopic_id : null,
      instruction,
      stem,
      options,
      year: Number(row.year),
      source: subject === "literature" ? "practice" : "past_paper",
      source_ref: row.id,
      status: "published",
    },
    solution: {
      question_id: row.id,
      correct_option: newLetter[row.correct_answer],
      hint: explanationBlocks(e.hint, subject) ?? null,
      solution,
    },
  };
}

// Run -----------------------------------------------------------------------

const rows = fs.readFileSync(`${DIR}/jamb_questions.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const taxonomy = JSON.parse(fs.readFileSync(`${DIR}/jamb_taxonomy.json`, "utf8"));
const holdList = JSON.parse(fs.readFileSync(`${DIR}/audit/hold-list.json`, "utf8"));
const dropped = new Set(JSON.parse(fs.readFileSync(`${DIR}/audit/duplicates-dropped.json`, "utf8")));
const held = new Map(holdList.map((h) => [h.id, h.reasons]));

const subjectOf = new Map(taxonomy.subjects.filter((s) => SUBJECTS[s.name] && s.exam_type === "JAMB").map((s) => [s.id, SUBJECTS[s.name]]));
const ready = rows.filter((r) => !held.has(r.id) && !dropped.has(r.id));
const usedTopics = new Set(ready.map((r) => r.topic_id).filter(Boolean));
const usedSubtopics = new Set(ready.map((r) => r.subtopic_id).filter(Boolean));
const topics = taxonomy.topics.filter((t) => usedTopics.has(t.id) && subjectOf.has(t.subject_id));
const subtopics = taxonomy.subtopics.filter((s) => usedSubtopics.has(s.id) && topics.some((t) => t.id === s.topic_id));
const topicIds = new Set(topics.map((t) => t.id));
const subtopicIds = new Set(subtopics.map((s) => s.id));

const converted = [];
const failed = [];
for (const row of ready) {
  const subject = SUBJECTS[row.subject_name];
  try {
    if (!subject) throw new ConversionError("unknown_subject");
    const c = convert(row, subject, topicIds, subtopicIds);
    const issues = validateQuestion({
      instruction: c.question.instruction,
      context: null,
      stem: c.question.stem,
      options: c.question.options,
      correctOption: c.solution.correct_option,
    });
    if (issues.length) throw new ConversionError(`validator:${issues.join("+")}`);
    converted.push(c);
  } catch (e) {
    if (!(e instanceof ConversionError)) throw e;
    failed.push({ id: row.id, subject: row.subject_name, question: row.question_text.slice(0, 160), reason: e.message });
  }
}

const tally = (items, f) => items.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
const report = {
  exported: rows.length,
  held: held.size,
  duplicatesDropped: dropped.size,
  readyAfterAudit: ready.length,
  converted: converted.length,
  failed: tally(failed, (f) => f.reason),
  optionsReshuffled: converted.filter((c) => c.moved).length,
  bySubject: tally(converted, (c) => c.question.subject_id),
  topics: topics.length,
  subtopics: subtopics.length,
  tagged: converted.filter((c) => c.question.topic_id).length,
  figures: converted.filter((c) => c.svg).length,
  answerLetters: Object.fromEntries(
    Object.values(SUBJECTS).map((s) => {
      const g = converted.filter((c) => c.question.subject_id === s);
      const n = tally(g, (c) => c.solution.correct_option);
      return [s, KEYS.map((k) => `${k}${Math.round(((n[k] ?? 0) / g.length) * 100)}`).join(" ")];
    }),
  ),
};
fs.writeFileSync(`${DIR}/audit/import-report.json`, JSON.stringify({ ...report, failures: failed }, null, 1));
fs.writeFileSync(`${DIR}/audit/converted-preview.json`, JSON.stringify(converted.map(({ question, solution, moved }) => ({ question, solution, moved })), null, 0));
console.log(JSON.stringify(report, null, 1));

if (!APPLY) {
  console.log("\nDry run. Nothing was written. Add --apply to load.");
  process.exit(0);
}

const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false, onnotice: () => {} });
const insertJson = async (tx, table, columns, items) => {
  const defs = columns.map(([name, type]) => `${name} ${type}`).join(", ");
  const names = columns.map(([name]) => name).join(", ");
  for (let i = 0; i < items.length; i += 400) {
    await tx.unsafe(`insert into public.${table} (${names}) select ${names} from jsonb_to_recordset($1::text::jsonb) as x(${defs})`, [JSON.stringify(items.slice(i, i + 400))]);
  }
};

for (const c of converted.filter((x) => x.svg)) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/question-media/solutions/${c.question.id}.svg`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`, apikey: process.env.SUPABASE_SECRET_KEY, "Content-Type": "image/svg+xml", "x-upsert": "true" },
    body: c.svg,
  });
  if (!res.ok) throw new Error(`Figure upload failed for ${c.question.id}: ${res.status} ${await res.text()}`);
}

await sql.begin(async (tx) => {
  const [{ n }] = await tx`select count(*)::int as n from public.questions`;
  if (n > 0) throw new Error(`The bank already holds ${n} questions. Stopping.`);

  await insertJson(tx, "topics", [["id", "uuid"], ["subject_id", "text"], ["slug", "text"], ["name", "text"], ["sort_order", "int"]],
    topics.map((t) => ({ id: t.id, subject_id: subjectOf.get(t.subject_id), slug: t.slug, name: t.name, sort_order: t.order_index })));
  await insertJson(tx, "subtopics", [["id", "uuid"], ["topic_id", "uuid"], ["slug", "text"], ["name", "text"], ["sort_order", "int"]],
    subtopics.map((s) => ({ id: s.id, topic_id: s.topic_id, slug: s.slug, name: s.name, sort_order: s.order_index })));
  await insertJson(tx, "questions", [["id", "uuid"], ["subject_id", "text"], ["topic_id", "uuid"], ["subtopic_id", "uuid"], ["instruction", "jsonb"], ["stem", "jsonb"], ["options", "jsonb"], ["year", "int"], ["source", "public.question_source"], ["source_ref", "text"], ["status", "public.question_status"]],
    converted.map((c) => c.question));
  await insertJson(tx, "question_solutions", [["question_id", "uuid"], ["correct_option", "text"], ["hint", "jsonb"], ["solution", "jsonb"]],
    converted.map((c) => c.solution));

  // Everything left out is kept with its reason, so repairs can be reviewed later.
  const [batch] = await tx`insert into public.question_import_batches (source, file_name, summary)
    values ('exam_prep_a1', 'jamb_questions.jsonl', ${tx.json(report)}) returning id`;
  const failReason = new Map(failed.map((f) => [f.id, f.reason]));
  const leftOut = rows
    .filter((r) => held.has(r.id) || dropped.has(r.id) || failReason.has(r.id))
    .map((r) => ({
      batch_id: batch.id,
      source_ref: r.id,
      raw: r,
      status: !held.has(r.id) && dropped.has(r.id) ? "duplicate" : "rejected",
      errors: held.get(r.id) ?? (failReason.has(r.id) ? [failReason.get(r.id)] : ["exact_duplicate"]),
    }));
  await insertJson(tx, "question_import_rows", [["batch_id", "uuid"], ["source_ref", "text"], ["raw", "jsonb"], ["status", "public.import_row_status"], ["errors", "text[]"]], leftOut);
});

const [check] = await sql`select
  (select count(*)::int from public.questions where status = 'published') as questions,
  (select count(*)::int from public.question_solutions) as solutions,
  (select count(*)::int from public.topics) as topics,
  (select count(*)::int from public.subtopics) as subtopics,
  (select count(*)::int from public.question_import_rows) as left_out`;
console.log("Loaded:", check);
await sql.end();
