import test from "node:test";
import assert from "node:assert/strict";
import { parseReply } from "../lib/myquest/enrich/parse.ts";
import { textToBlocks, textToInline, toSolution } from "../lib/myquest/enrich/convert.ts";
import { buildPrompt, codeTopics, makeBatches, questionId } from "../lib/myquest/enrich/prompt.ts";
import { checkBatch } from "../lib/myquest/enrich/check.ts";
import { normalisePaper } from "../lib/myquest/normalise.ts";

const R = String.raw;

// Parse ----------------------------------------------------------------------

test("a clean array parses with no warnings", () => {
  const r = parseReply('[{"id":"q1-aaaa","status":"solved"},{"id":"q2-bbbb","status":"solved"}]');
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.error, null);
});

test("a code fence with words before and after is read, and the ignored text is reported", () => {
  const r = parseReply('Here you go:\n```json\n[{"id":"q1-aaaa"}]\n```\nHope that helps!');
  assert.equal(r.items.length, 1);
  assert.ok(r.warnings.some((w) => /outside the code block/.test(w)));
});

test("a wrapper object with an items array is accepted", () => {
  assert.equal(parseReply('{"batch":"B1","items":[{"id":"q1-aaaa"}]}').items.length, 1);
});

test("doubled LaTeX backslashes are left exactly as they are", () => {
  const r = parseReply(R`[{"formula":"$\\frac{1}{2} \\times 3$"}]`);
  assert.equal(r.items[0].formula, R`$\frac{1}{2} \times 3$`);
  assert.deepEqual(r.warnings, []);
});

test("single LaTeX backslashes are repaired, including the ones JSON would silently turn into control characters", () => {
  const r = parseReply(R`[{"formula":"$\frac{1}{2} \times 3 \theta \pi \right)$"}]`);
  assert.equal(r.items[0].formula, R`$\frac{1}{2} \times 3 \theta \pi \right)$`);
  assert.ok(r.warnings.some((w) => /backslash/.test(w)));
  assert.ok(!/[\f\t\b\r]/.test(r.items[0].formula));
});

test("a real JSON newline escape is kept as a newline", () => {
  const r = parseReply(R`[{"why":"line one\nline two"}]`);
  assert.equal(r.items[0].why, "line one\nline two");
});

test("a raw line break inside a string and a trailing comma are fixed", () => {
  const r = parseReply('[{"why":"one\ntwo",},]');
  assert.equal(r.items[0].why, "one\ntwo");
  assert.ok(r.warnings.length >= 2);
});

test("a reply cut off part way keeps every complete question", () => {
  const r = parseReply('[{"id":"q1-aaaa","why":"a"},{"id":"q2-bbbb","why":"b"},{"id":"q3-cccc","why":"cut o');
  assert.deepEqual(r.items.map((i) => i.id), ["q1-aaaa", "q2-bbbb"]);
  assert.equal(r.truncated, true);
  assert.ok(r.warnings.some((w) => /cut off/.test(w)));
});

test("one broken question is skipped and the rest are kept", () => {
  const r = parseReply('[{"id":"q1-aaaa"},{"id":"q2-bbbb" "oops":},{"id":"q3-cccc"}]');
  assert.deepEqual(r.items.map((i) => i.id), ["q1-aaaa", "q3-cccc"]);
  assert.ok(r.warnings.some((w) => /could not be read/.test(w)));
});

test("empty and non-JSON pastes give a clear error", () => {
  assert.match(parseReply("  ").error, /Nothing was pasted/);
  assert.match(parseReply("Sorry, I cannot help with that.").error, /No JSON/);
});

// Convert --------------------------------------------------------------------

test("text becomes inline maths and marks, and a backslash dollar stays a dollar", () => {
  const { inline, unbalanced, dollarsUnbalanced } = textToInline(R`Use **bold**, *italic* and $x^{2}$. It costs \$5.`);
  assert.equal(unbalanced, false);
  assert.equal(dollarsUnbalanced, false);
  assert.deepEqual(inline[0], { text: "Use " });
  assert.deepEqual(inline[1], { text: "bold", marks: ["bold"] });
  assert.ok(inline.some((c) => c.math === "x^{2}"));
  assert.ok(inline.some((c) => c.text?.includes("$5")));
});

test("unclosed marks and dollars are detected", () => {
  assert.equal(textToInline("a **b").unbalanced, true);
  assert.equal(textToInline("a $b").dollarsUnbalanced, true);
});

test("a line that is only maths becomes a maths block", () => {
  const problems = [];
  assert.deepEqual(textToBlocks("$v = u + at$", "f", problems), [{ type: "math", tex: "v = u + at" }]);
  assert.equal(problems.length, 0);
});

test("an item becomes a v2 solution with steps, wrong options and a hint", () => {
  const { solution, hint } = toSolution({
    concept: "Momentum",
    intro: "Let's work it out.",
    formula: "$p = mv$",
    variables: ["$p$ = momentum", "$m$ = mass (kg)"],
    steps: [{ title: "Substitute", lines: ["$p = 2 \\times 3$", "$p = 6$ kg m/s"] }],
    why: "Momentum is mass times velocity.",
    wrong: { A: "This divides instead of multiplying.", C: "This adds the two numbers." },
    hint: "Multiply mass by velocity.",
    tip: "",
  });
  assert.equal(solution.concept, "Momentum");
  assert.equal(solution.formula[0].tex, "p = mv");
  assert.equal(solution.variables.length, 2);
  assert.equal(solution.steps[0].blocks.length, 2);
  assert.deepEqual(Object.keys(solution.wrongOptions), ["A", "C"]);
  assert.equal(solution.studyTip, undefined);
  assert.equal(hint.length, 1);
});

// Prompt and batching --------------------------------------------------------

const row = (id, over = {}) => ({
  id,
  question: `Physics question number ${id} about motion?`,
  options: { A: `a${id}`, B: `b${id}`, C: `c${id}`, D: `d${id}` },
  correct_answer: "B",
  explanation: "Provider explanation text that must never be sent.",
  image: null,
  ...over,
});
const REF = { exam: "JAMB", exam_year_id: "2005", subject: "Physics" };
const topics = codeTopics(
  [
    { id: "t-motion", name: "Motion", subtopics: [{ id: "s-vel", name: "Velocity" }, { id: "s-acc", name: "Acceleration" }] },
    { id: "t-light", name: "Light", subtopics: [] },
  ],
  "P",
);

test("topics get short stable codes", () => {
  assert.deepEqual(topics.map((t) => t.code), ["P01", "P02"]);
  assert.deepEqual(topics[0].subs.map((s) => s.code), ["P01.1", "P01.2"]);
});

test("a paper splits into batches of ten, rejected rows are left out and figures are numbered per batch", () => {
  const rows = Array.from({ length: 24 }, (_, i) => row(i + 1, i === 3 || i === 12 ? { image: "https://x.test/i.jpg", question: `Study the diagram. Question ${i + 1}?` } : {}));
  rows.push(row(99, { correct_answer: "" })); // rejected: no key
  const { questions } = normalisePaper(REF, rows);
  const batches = makeBatches(questions, 10);
  assert.deepEqual(batches.map((b) => b.length), [10, 10, 4]);
  assert.deepEqual(batches[0].filter((b) => b.figure).map((b) => b.figure), ["F1"]);
  assert.deepEqual(batches[1].filter((b) => b.figure).map((b) => b.figure), ["F1"]);
  assert.equal(new Set(batches.flat().map((b) => b.id)).size, 24);
});

test("the question id changes if the question text changes", () => {
  assert.notEqual(questionId(1, "ref", "What is speed?"), questionId(1, "ref", "What is velocity?"));
  assert.match(questionId(7, "ref", "x"), /^q7-[0-9a-f]{4}$/);
});

test("the prompt carries the questions and topic codes but never the provider key or explanation", () => {
  const { questions } = normalisePaper(REF, [row(1), row(2, { image: "https://x.test/i.jpg", question: "Study the diagram. Where is the image?" })]);
  const [batch] = makeBatches(questions);
  const p = buildPrompt({ subjectId: "physics", subjectName: "Physics", batchNo: 1, batches: 1, topics, batch });
  for (const b of batch) assert.ok(p.includes(`=== ${b.id} ===`));
  assert.ok(p.includes("P01.2  Acceleration"));
  assert.ok(p.includes("F1 (attached image)"));
  assert.ok(!p.includes("Provider explanation"));
  assert.ok(!/correct_answer/.test(p));
  assert.ok(p.includes("SUBJECT MODULE: calculation subjects"));
});

test("a subject with no topic list says so", () => {
  const { questions } = normalisePaper(REF, [row(1)]);
  const p = buildPrompt({ subjectId: "commerce", subjectName: "Commerce", batchNo: 1, batches: 1, topics: [], batch: makeBatches(questions)[0] });
  assert.ok(p.includes("No topic list exists"));
});

// Check ----------------------------------------------------------------------

function setup(n = 2, over = {}) {
  const { questions } = normalisePaper(REF, Array.from({ length: n }, (_, i) => row(i + 1, over)));
  return makeBatches(questions)[0];
}
const good = (id, over = {}) => ({
  id,
  status: "solved",
  answer: "B",
  confidence: "certain",
  topic: "P01",
  subtopic: "P01.2",
  concept: "Motion",
  intro: "Let's see.",
  formula: "",
  variables: [],
  steps: [],
  why: "Because the body speeds up at a steady rate.",
  wrong: { A: "This describes a body at rest, not one that speeds up.", C: "This describes steady speed with no change.", D: "This describes a body that slows down." },
  hint: "Think about the rate of change of speed.",
  tip: "",
  figure_alt: "",
  illustration: "",
  issues: [],
  ...over,
});
const codes = (q) => q.flags.map((f) => f.code);

test("a good reply is publishable and carries the topic ids", () => {
  const batch = setup(1);
  const { questions } = checkBatch("physics", batch, [good(batch[0].id)], topics);
  assert.equal(questions[0].publishable, true, JSON.stringify(questions[0].flags));
  assert.equal(questions[0].topic.topicId, "t-motion");
  assert.equal(questions[0].subtopic.subtopicId, "s-acc");
  assert.equal(questions[0].aiKey, "B");
});

test("a question the AI skipped, and ids the batch does not have, are reported", () => {
  const batch = setup(2);
  const out = checkBatch("physics", batch, [good(batch[0].id), good("q99-zzzz")], topics);
  assert.equal(out.questions[1].publishable, false);
  assert.deepEqual(codes(out.questions[1]), ["not_answered"]);
  assert.deepEqual(out.unknownIds, ["q99-zzzz"]);
});

test("a changed check code is treated as an unknown question, so a mangled id cannot match", () => {
  const batch = setup(1);
  const mangled = batch[0].id.replace(/.$/, (c) => (c === "0" ? "1" : "0"));
  const out = checkBatch("physics", batch, [good(mangled)], topics);
  assert.deepEqual(codes(out.questions[0]), ["not_answered"]);
  assert.deepEqual(out.unknownIds, [mangled]);
});

test("the AI disagreeing with the provider key blocks the question", () => {
  const batch = setup(1);
  const out = checkBatch("physics", batch, [good(batch[0].id, { answer: "C", wrong: { A: "x".repeat(20), B: "y".repeat(20), D: "z".repeat(20) } })], topics);
  assert.ok(codes(out.questions[0]).includes("key_disputed"));
  assert.equal(out.questions[0].publishable, false);
});

test("unsolved statuses block, with the AI's reason", () => {
  const batch = setup(3);
  const out = checkBatch(
    "physics",
    batch,
    [
      { id: batch[0].id, status: "missing_context", issues: ["No diagram supplied"] },
      { id: batch[1].id, status: "ambiguous", alternatives: ["A", "C"], issues: ["Two fit"] },
      { id: batch[2].id, status: "unsure", best_guess: "B", issues: [] },
    ],
    topics,
  );
  for (const q of out.questions) assert.deepEqual(codes(q), ["status_not_solved"]);
  assert.match(out.questions[0].flags[0].detail, /No diagram/);
  assert.match(out.questions[1].flags[0].detail, /A, C/);
  assert.match(out.questions[2].flags[0].detail, /Best guess: B/);
});

test("a bad topic code, and a subtopic under the wrong topic, block", () => {
  const batch = setup(2);
  const out = checkBatch("physics", batch, [good(batch[0].id, { topic: "P09", subtopic: "none" }), good(batch[1].id, { topic: "P02", subtopic: "P01.1" })], topics);
  assert.ok(codes(out.questions[0]).includes("topic_invalid"));
  assert.ok(codes(out.questions[1]).includes("topic_invalid"));
});

test("topic none is allowed with a warning", () => {
  const batch = setup(1);
  const q = checkBatch("physics", batch, [good(batch[0].id, { topic: "none", subtopic: "none" })], topics).questions[0];
  assert.ok(codes(q).includes("no_topic"));
  assert.equal(q.publishable, true);
});

test("wrong-option reasons must be exactly the other options", () => {
  const batch = setup(1);
  const q = checkBatch("physics", batch, [good(batch[0].id, { wrong: { A: "a reason that is long enough", B: "the answer should not be here", C: "another long enough reason" } })], topics).questions[0];
  assert.ok(codes(q).includes("wrong_set"));
});

test("a generic or very short wrong-option reason is a warning", () => {
  const batch = setup(1);
  const q = checkBatch("physics", batch, [good(batch[0].id, { wrong: { A: "Wrong.", C: "This describes steady speed with no change.", D: "This describes a body that slows down." } })], topics).questions[0];
  assert.ok(codes(q).includes("wrong_thin"));
  assert.equal(q.publishable, true);
});

test("maths that will not render blocks, maths that will is fine", () => {
  const batch = setup(2);
  const out = checkBatch(
    "physics",
    batch,
    [good(batch[0].id, { formula: "$\\frac{1}{$" }), good(batch[1].id, { formula: "$v = u + at$", steps: [{ title: "Substitute", lines: ["$v = 0 + 10 \\times 5$"] }] })],
    topics,
  );
  assert.ok(codes(out.questions[0]).includes("math_invalid"));
  assert.equal(codes(out.questions[1]).includes("math_invalid"), false);
});

test("option letters and the answer sentence in the explanation are warned about", () => {
  const batch = setup(1);
  const q = checkBatch("physics", batch, [good(batch[0].id, { why: "The correct answer is option B because it speeds up." })], topics).questions[0];
  assert.ok(codes(q).includes("letter_in_prose"));
  assert.ok(codes(q).includes("correct_phrase"));
});

test("a source figure needs a description, and always needs saving", () => {
  const batch = setup(1, { image: "https://x.test/i.jpg", question: "Study the diagram. What is shown?" });
  const q = checkBatch("physics", batch, [good(batch[0].id)], topics).questions[0];
  assert.ok(codes(q).includes("figure_needs_description"));
  assert.ok(codes(q).includes("figure_needs_media"));
  assert.equal(q.figure.label, "F1");
});

test("a recall subject with steps, and a calculation without, are warned", () => {
  const batch = setup(1, { question: "A body of mass 2 kg moves at 3 m/s. What is its momentum?", options: { A: "6", B: "5", C: "1.5", D: "9" } });
  const noSteps = checkBatch("physics", batch, [good(batch[0].id)], topics).questions[0];
  assert.ok(codes(noSteps).includes("steps_missing"));
  const gov = setup(1);
  const recall = checkBatch("government", gov, [good(gov[0].id, { topic: "none", subtopic: "none", steps: [{ title: "Step", lines: ["$1 + 1 = 2$"] }] })], []).questions[0];
  assert.ok(codes(recall).includes("steps_unneeded"));
});

test("a reply that answers one question twice is blocked", () => {
  const batch = setup(1);
  const q = checkBatch("physics", batch, [good(batch[0].id), good(batch[0].id)], topics).questions[0];
  assert.ok(codes(q).includes("duplicate_reply"));
});

// Publish ---------------------------------------------------------------------

import { buildRow, selectForPublish } from "../lib/myquest/enrich/publish.ts";

test("only questions with no blocking flag go live, and published ones are never offered twice", () => {
  const batch = setup(4);
  const { questions } = checkBatch(
    "physics",
    batch,
    [good(batch[0].id), good(batch[1].id, { topic: "P09" }), { id: batch[2].id, status: "missing_context", issues: ["no diagram"] }, good(batch[3].id)],
    topics,
  );
  const live = new Set([questions[3].sourceRef]);
  const { include, excluded } = selectForPublish(questions, new Set(), live);
  assert.deepEqual(include.map((q) => q.position), [1]);
  assert.deepEqual(excluded.map((e) => [e.position, e.reason]), [[2, "blocked"], [3, "blocked"], [4, "already_published"]]);
});

test("a disputed answer can go live only when the reviewer accepts the AI's answer, and nothing else can be overridden", () => {
  const batch = setup(2);
  const wrong = { A: "x".repeat(20), C: "y".repeat(20), D: "z".repeat(20) };
  const disputed = (id, over = {}) => good(id, { answer: "A", wrong: { B: "x".repeat(20), C: "y".repeat(20), D: "z".repeat(20) }, ...over });
  const { questions } = checkBatch("physics", batch, [disputed(batch[0].id), disputed(batch[1].id, { topic: "P09" })], topics);
  assert.ok(questions[0].flags.some((f) => f.code === "key_disputed"));
  const all = new Set(questions.map((q) => q.id));
  const none = selectForPublish(questions, new Set(), new Set());
  assert.equal(none.include.length, 0);
  const accepted = selectForPublish(questions, all, new Set());
  assert.deepEqual(accepted.include.map((q) => q.position), [1]); // question 2 also has a bad topic, which cannot be overridden
  assert.ok(wrong);
});

test("a published row carries the AI key, the stem with its saved diagram first, and the audit trail", () => {
  const batch = setup(1, { image: "https://x.test/i.jpg", question: "Study the diagram. What is shown?" });
  const { questions } = checkBatch("physics", batch, [good(batch[0].id, { figure_alt: "A concave mirror with an object at 24 cm." })], topics);
  const row = buildRow(questions[0], { subjectId: "physics", year: 2005, raw: { id: 1 }, figureSrc: "myquest/p/abc.jpg", model: "Claude", promptVersion: "p1", overridden: false });
  assert.equal(row.correct_option, "B");
  assert.equal(row.stem[0].type, "figure");
  assert.equal(row.stem[0].src, "myquest/p/abc.jpg");
  assert.equal(row.stem[0].alt, "A concave mirror with an object at 24 cm.");
  assert.equal(row.topic_id, "t-motion");
  assert.equal(row.year, 2005);
  assert.equal(row.normalised.model, "Claude");
  assert.ok(row.source_ref.startsWith("mq:JAMB:2005:Physics:"));
});

test("by default a paper is one prompt, with figures numbered across the whole paper", () => {
  const rows = Array.from({ length: 40 }, (_, i) => row(i + 1, i % 8 === 0 ? { image: "https://x.test/i.jpg", question: `Study the diagram. Question ${i + 1}?` } : {}));
  const { questions } = normalisePaper(REF, rows);
  const batches = makeBatches(questions);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 40);
  assert.deepEqual(batches[0].filter((b) => b.figure).map((b) => b.figure), ["F1", "F2", "F3", "F4", "F5"]);
  const p = buildPrompt({ subjectId: "physics", subjectName: "Physics", batchNo: 1, batches: 1, topics, batch: batches[0] });
  assert.ok(p.includes("Subject: Physics. 40 questions."));
  assert.ok(!p.includes("Part 1 of"));
});

test("a long reply sent in two parts is joined in order", () => {
  const fence = "```";
  const text = ["Part one:", fence + "json", '[{"id":"q1-aaaa"},{"id":"q2-bbbb"}]', fence, "Part two:", fence + "json", '[{"id":"q3-cccc"}]', fence].join("\n");
  const r = parseReply(text);
  assert.deepEqual(r.items.map((i) => i.id), ["q1-aaaa", "q2-bbbb", "q3-cccc"]);
  assert.ok(r.warnings.some((w) => /2 parts/.test(w)));
});

test("a second part that is itself cut off keeps the complete questions from both", () => {
  const r = parseReply(['[{"id":"q1-aaaa"}]', '[{"id":"q2-bbbb"},{"id":"q3-cccc","why":"cut o'].join("\n"));
  assert.deepEqual(r.items.map((i) => i.id), ["q1-aaaa", "q2-bbbb"]);
  assert.equal(r.truncated, true);
});
