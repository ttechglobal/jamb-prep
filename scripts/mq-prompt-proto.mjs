// PROTOTYPE of the prompt builder, for the by-hand test. Not the app yet.
//
//   node --env-file=.env.local scripts/mq-prompt-proto.mjs
//
// Builds one batch of 10 questions from the stored JAMB 2025 Physics paper:
// the 5 diagram questions plus 5 others. The provider answer key is NOT put in the prompt.
// Output (gitignored): data/imports/myquest/prompts/physics-2025-batch1/
import crypto from "node:crypto";
import fs from "node:fs";
import postgres from "postgres";
import { plainText } from "../lib/content/validate.ts";

const PAPER = "data/imports/myquest/papers/mq_JAMB_2025_Physics";
const OUT = "data/imports/myquest/prompts/physics-2025-batch1";
fs.mkdirSync(OUT, { recursive: true });

const { ref, questions } = JSON.parse(fs.readFileSync(`${PAPER}/normalised.json`, "utf8"));
const raw = JSON.parse(fs.readFileSync(`${PAPER}/page-1.json`, "utf8")).data.questions;
const rawById = new Map(raw.map((r) => [String(r.id), r]));

// Choose 10: every diagram question, then two with numbers and three without.
const withFigure = questions.filter((q) => q.remoteImage);
const rest = questions.filter((q) => !q.remoteImage);
const numeric = rest.filter((q) => /\d/.test(plainText(q.stem)));
const recall = rest.filter((q) => !/\d/.test(plainText(q.stem)));
const chosen = [...withFigure, ...numeric.slice(0, 2), ...recall.slice(0, 3)].sort((a, b) => a.providerId - b.providerId);

// Topics with short codes, from the database.
const sql = postgres(process.env.SUPABASE_DB_URL);
const topics = await sql`select id, name from topics where subject_id='physics' and active order by sort_order, name`;
const subs = await sql`select s.id, s.name, s.topic_id from subtopics s join topics t on t.id=s.topic_id where t.subject_id='physics' and s.active order by s.sort_order, s.name`;
await sql.end();
const codeMap = {};
const topicLines = topics.map((t, i) => {
  const tc = `P${String(i + 1).padStart(2, "0")}`;
  codeMap[tc] = { type: "topic", id: t.id, name: t.name };
  const mine = subs.filter((s) => s.topic_id === t.id);
  const lines = [`${tc}  ${t.name}`];
  mine.forEach((s, j) => {
    const sc = `${tc}.${j + 1}`;
    codeMap[sc] = { type: "subtopic", id: s.id, name: s.name, topic: tc };
    lines.push(`    ${sc}  ${s.name}`);
  });
  return lines.join("\n");
});

// Questions.
const figureNo = new Map(withFigure.map((q, i) => [q.sourceRef, i + 1]));
const keyFile = {};
const blocks = chosen.map((q, n) => {
  const stem = plainText(q.stem);
  const check = crypto.createHash("sha256").update(`${q.sourceRef}|${stem}`).digest("hex").slice(0, 4);
  const id = `q${n + 1}-${check}`;
  const fig = figureNo.get(q.sourceRef);
  keyFile[id] = { sourceRef: q.sourceRef, providerId: q.providerId, providerKey: q.correctOption, figure: fig ? `F${fig}` : null };
  const opts = q.options.map((o) => `${o.key}. ${plainText(o.blocks)}`).join("\n");
  return [
    `=== ${id} ===`,
    "Instruction: (none)",
    `Source figure: ${fig ? `F${fig} (attached image)` : "none"}`,
    "Passage: (none)",
    "Question:",
    stem,
    "Options:",
    opts,
    "Content notes: none",
  ].join("\n");
});

const MODULE_CALC = `SUBJECT MODULE: calculation subjects (Physics)
- Decide per question. If it needs a number computed, give steps. If it is recall, definition or
  description, steps: none, formula: none, variables: none.
- For calculations: list every given value with its symbol and unit first, name the equation,
  rearrange on its own line if needed, substitute one line at a time, compute one operation per
  line, then state the result with units.
- "formula" is the key named equation, for example $v = u + at$. "variables" decodes each symbol
  with its unit, one per line, only when a formula is given.
- hint: one sentence, at most 20 words, that nudges without giving the answer.`;

const REPLY_FORMAT = `#REPLY v1 batch=B1
then, for EVERY question above, exactly one item:
#ITEM <id exactly as written after ===>
status: solved | missing_context | ambiguous | unsure
answer: <one letter>               (solved only)
confidence: certain | likely       (solved only)
topic: <code or none>
subtopic: <code or none>
concept: <short phrase>
intro: <one sentence>
formula: <maths or none>
variables:                          (or: variables: none)
- <symbol> = <meaning> (<unit>)
steps:                              (or: steps: none)
- <step title>
  <line of maths>
  <another line of maths>
why: <1 to 3 sentences on why the correct option is right. No option letters.>
wrong.<LETTER>: <why that option is wrong. One entry for each option except the answer.>
hint: <one short sentence>
tip: <one short exam tip, or none>
figure_alt: <what is visible in the attached figure, or none>
illustration: none | needed: <what a diagram would show and why>
issues: none | <what is missing or uncertain>
#END
and finally #ENDREPLY

For any status other than solved, write only: status, issues, and where it applies
"alternatives: A, C" (ambiguous) or "best_guess: B" (unsure). Nothing else.
A field may continue on following lines if they are indented by two spaces.
"none" means deliberately empty. Never leave a field out.

Example of one item (a different subject, shown only for layout):
#ITEM q9-1f2e
status: solved
answer: C
confidence: certain
topic: M04
subtopic: M04.2
concept: Curved surface area of a cylinder
intro: Let's work through this step by step.
formula: $CSA = 2\\pi r h$
variables:
- $r$ = radius (cm)
- $h$ = height (cm)
steps:
- Find the radius
  $r = 8 \\div 2 = 4$ cm
- Substitute and compute
  $CSA = 2 \\times \\frac{22}{7} \\times 4 \\times 14$
  $CSA = 352$ cm²
why: The curved surface of a cylinder is 2πrh, and with r = 4 cm and h = 14 cm that gives 352 cm².
wrong.A: This is the area of one circular end, not the curved surface.
wrong.B: This uses the total surface area, which wrongly adds both circular ends.
wrong.D: This puts the diameter (8 cm) into the formula in place of the radius.
hint: Start by writing the formula for curved surface area.
tip: Halve the diameter before substituting.
figure_alt: none
illustration: none
issues: none
#END`;

const prompt = `You are an expert Nigerian JAMB UTME teacher writing for 15 to 18 year old students.
Subject: Physics. Batch B1, ${chosen.length} questions.

Solve every question yourself. No answer key is given. Use only what is supplied.

RULES
1. Do not invent a passage, quotation, table value, diagram or label. If something the question
   depends on is missing or unreadable, say so in the status and stop on that question.
2. A question is "solved" only if exactly one option is defensibly correct and everything needed is
   present. Otherwise use missing_context, ambiguous or unsure (see STATUS).
3. Before writing, silently check: your answer matches your reasoning, the arithmetic is right, and
   no other option also works.
4. Never write an option letter inside explanation text. Refer to options by what they say.
   (Letters appear only as field names such as wrong.B.)
5. Do not write "The correct answer is...". The app adds that line.
6. Plain language. Say "so" and "this means", not "hence" or "thus". No filler.
7. Maths goes in $...$ using ordinary LaTeX with single backslashes. Display maths on its own line.
   Currency is the naira sign directly, for example ₦500.
8. Marks: **bold** for the key term, *italic* for secondary terms. No other markup, no HTML.

STATUS
solved           one unique correct option, everything needed is present.
missing_context  something required is absent (say exactly what, in issues).
ambiguous        more than one option is defensible (list them as alternatives).
unsure           everything is present but you cannot verify a unique answer. Give best_guess.
                 A best guess is never used as the answer.

TOPICS
Choose from this closed list. Give the code, or "none" if nothing fits. Never invent a code.
A subtopic code must sit under the topic you chose.
${topicLines.join("\n")}

${MODULE_CALC}

QUESTIONS

${blocks.join("\n\n")}

FIGURES
Images F1 to F${withFigure.length} are attached to this chat, in order. Look at each image before answering
its question. If an image is missing or you cannot read it, use missing_context. In figure_alt, describe
only what you can actually see in the image: labels, values, shapes, one or two sentences. Do not use the
image to invent anything that is not drawn.

OUTPUT
Reply with the REPLY FORMAT below, inside ONE code block so it copies cleanly. Nothing outside the block.

REPLY FORMAT
${REPLY_FORMAT}
`;

fs.writeFileSync(`${OUT}/prompt.txt`, prompt);
fs.writeFileSync(`${OUT}/topic-codes.json`, JSON.stringify(codeMap, null, 2));
fs.writeFileSync(`${OUT}/provider-keys-DO-NOT-PASTE.json`, JSON.stringify(keyFile, null, 2));

// Number the images F1..Fn in the same order.
const manifest = JSON.parse(fs.readFileSync("data/imports/myquest/media/mq_JAMB_2025_Physics/manifest.json", "utf8"));
withFigure.forEach((q, i) => {
  const m = manifest[q.sourceRef];
  fs.copyFileSync(`data/imports/myquest/media/mq_JAMB_2025_Physics/${m.file}`, `${OUT}/F${i + 1}.jpg`);
});

console.log(`questions ${chosen.length}, figures ${withFigure.length}, topics ${topics.length}, subtopics ${subs.length}`);
console.log(`prompt: ${prompt.length} characters, about ${prompt.split(/\s+/).length} words`);
console.log(Object.entries(keyFile).map(([id, k]) => `${id} #${k.providerId}${k.figure ? " " + k.figure : ""}`).join(", "));
