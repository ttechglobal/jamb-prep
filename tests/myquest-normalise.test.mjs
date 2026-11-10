import test from "node:test";
import assert from "node:assert/strict";
import { normaliseRow, normalisePaper } from "../lib/myquest/normalise.ts";

const REF = { exam: "JAMB", exam_year_id: "2025", subject: "Physics" };
const base = (over = {}) => ({
  id: 1,
  question: "Which of the following is a unit of pressure?",
  options: { A: "Joule", B: "Pascal", C: "Watt", D: "Newton" },
  correct_answer: "B",
  explanation: "Pressure is force per unit area, measured in pascals.",
  image: null,
  ...over,
});
const text = (blocks) => blocks.flatMap((b) => b.content.map((c) => c.text)).join("");

test("a clean row is ready, with the key bound to the option text", () => {
  const q = normaliseRow(REF, base());
  assert.equal(q.status, "ready");
  assert.equal(q.correctOption, "B");
  assert.equal(q.correctText, "Pascal");
  assert.equal(q.sourceRef, "mq:JAMB:2025:Physics:1");
  assert.equal(q.options.length, 4);
});

test("the same provider id in two papers never shares a source ref", () => {
  const a = normaliseRow(REF, base());
  const b = normaliseRow({ ...REF, subject: "Chemistry" }, base());
  assert.notEqual(a.sourceRef, b.sourceRef);
});

test("lower-case keys and option letters are accepted", () => {
  const q = normaliseRow(REF, base({ options: { a: "1", b: "2", c: "3", d: "4" }, correct_answer: "c" }));
  assert.equal(q.status, "ready");
  assert.equal(q.correctText, "3");
});

test("missing or invalid keys are rejected, a key outside the options too", () => {
  assert.equal(normaliseRow(REF, base({ correct_answer: "" })).status, "rejected");
  assert.ok(normaliseRow(REF, base({ correct_answer: "E" })).reasons.includes("invalid_answer"));
  const three = normaliseRow(REF, base({ options: { A: "1", B: "2", C: "3" }, correct_answer: "D" }));
  assert.equal(three.status, "rejected");
  assert.ok(three.reasons.includes("answer_not_in_options") && three.reasons.includes("not_four_options"));
});

test("an empty or duplicate option is caught", () => {
  assert.equal(normaliseRow(REF, base({ options: { A: "1", B: "", C: "3", D: "4" } })).status, "rejected");
  const dup = normaliseRow(REF, base({ options: { A: "Same", B: "same ", C: "3", D: "4" } }));
  assert.equal(dup.status, "held");
  assert.ok(dup.reasons.includes("duplicate_option_text"));
});

test("an embedded own-letter label is stripped, a different letter is not", () => {
  const q = normaliseRow(REF, base({ options: { A: "A. Joule", B: "B) Pascal", C: "C: Watt", D: "D. Newton" } }));
  assert.equal(text(q.options[0].blocks), "Joule");
  assert.equal(q.correctText, "Pascal");
  assert.equal(q.status, "ready");
  const kept = normaliseRow(REF, base({ options: { A: "B. Smith", B: "Two", C: "Three", D: "Four" } }));
  assert.equal(text(kept.options[0].blocks), "B. Smith");
});

test("a blank stem is rejected", () => {
  assert.equal(normaliseRow(REF, base({ question: "  " })).status, "rejected");
});

test("an image holds the row until it is mirrored and described", () => {
  const q = normaliseRow(REF, base({ question: "Study the diagram. What is shown?", image: "https://example.test/api/image.php?token=abc" }));
  assert.equal(q.status, "held");
  assert.ok(q.reasons.includes("figure_needs_media"));
  assert.equal(q.remoteImage, "https://example.test/api/image.php?token=abc");
});

test("a diagram reference with no image is held as a missing figure", () => {
  const q = normaliseRow(REF, base({ question: "In the circuit diagram above, what is the current?" }));
  assert.ok(q.reasons.includes("missing_figure"));
});

test("prose that only mentions a figure of speech is not a figure", () => {
  const q = normaliseRow({ ...REF, subject: "Use of English" }, base({ question: "The expression is a figure of speech. Which one?" }));
  assert.ok(!q.reasons.includes("missing_figure"));
});

test("explanation checks: missing, placeholder, admits a problem, names another option", () => {
  assert.ok(normaliseRow(REF, base({ explanation: "" })).reasons.includes("missing_explanation"));
  assert.ok(normaliseRow(REF, base({ explanation: "x" })).reasons.includes("placeholder_explanation"));
  assert.ok(normaliseRow(REF, base({ explanation: "None of the options fit, so B is the best guess." })).reasons.includes("explanation_admits_problem"));
  assert.ok(normaliseRow(REF, base({ explanation: "The correct answer is C because force acts." })).reasons.includes("explanation_names_other_option"));
  assert.ok(!normaliseRow(REF, base({ explanation: "The correct answer is B because pascals measure pressure." })).reasons.includes("explanation_names_other_option"));
});

test("safe marks survive, other tags and entities are cleaned, powers become superscripts", () => {
  const q = normaliseRow(REF, base({ question: "Choose the <u>underlined</u> word &amp; <script>x</script>speed in m/s^2 and 10^{-3}" }));
  const content = q.stem[0].content;
  assert.deepEqual(content[1], { text: "underlined", marks: ["underline"] });
  assert.equal(text(q.stem), "Choose the underlined word & speed in m/s2 and 10-3");
  assert.ok(content.some((c) => c.text === "2" && c.marks?.[0] === "superscript"));
  assert.ok(content.some((c) => c.text === "-3" && c.marks?.[0] === "superscript"));
});

test("the same question with options in a different order is a duplicate in the paper", () => {
  const rows = [base({ id: 1 }), base({ id: 2, options: { A: "Newton", B: "Watt", C: "Pascal", D: "Joule" }, correct_answer: "C" })];
  const { questions } = normalisePaper(REF, rows);
  assert.equal(questions[1].status, "held");
  assert.ok(questions[1].reasons.includes("duplicate_in_paper"));
});

test("a skewed key is reported on a paper of 40", () => {
  const keys = "BBCBCBBBBBCCBBBCBCBCACBCACBBCBBBACABBCBB".split("");
  const { report } = normalisePaper(REF, keys.map((k, i) => base({ id: i + 1, question: `Question ${i + 1}`, correct_answer: k })));
  assert.equal(report.keySkew, true);
  assert.equal(report.keyCounts.D, 0);
  const even = normalisePaper(REF, Array.from({ length: 40 }, (_, i) => base({ id: i + 1, question: `Question ${i + 1}`, correct_answer: "ABCD"[i % 4] })));
  assert.equal(even.report.keySkew, false);
});
