/**
 * Builds the text the admin copies into an AI chat: the instructions, a closed topic list, and one
 * batch of questions. The provider's answer key is never included, so the AI really solves blind.
 */
import { createHash } from "node:crypto";
import { plainText } from "../../content/validate.ts";
import type { NormalisedQuestion } from "../normalise.ts";
import { MODULE_FOR_SUBJECT, MODULE_TEXT } from "./modules.ts";

export const PROMPT_VERSION = "p1";
/** One prompt for the whole paper. Pass a smaller size to split it. */
export const BATCH_SIZE = 1000;

export interface TopicEntry {
  code: string;
  id: string;
  name: string;
  subs: { code: string; id: string; name: string }[];
}

/** Short codes the AI can copy without error: P01, P01.2. Stable for a given ordered topic list. */
export function codeTopics(topics: { id: string; name: string; subtopics: { id: string; name: string }[] }[], letter: string): TopicEntry[] {
  return topics.map((t, i) => {
    const code = `${letter}${String(i + 1).padStart(2, "0")}`;
    return { code, id: t.id, name: t.name, subs: t.subtopics.map((s, j) => ({ code: `${code}.${j + 1}`, id: s.id, name: s.name })) };
  });
}

/** q12-a3f9: the position in the paper plus a check code, so a mangled id is caught immediately. */
export function questionId(position: number, sourceRef: string, stemText: string): string {
  const check = createHash("sha256").update(`${sourceRef}|${stemText}`).digest("hex").slice(0, 4);
  return `q${position}-${check}`;
}

export interface BatchQuestion {
  id: string;
  position: number;
  question: NormalisedQuestion;
  /** F1, F2 within the batch, when the question has a source figure. */
  figure: string | null;
}

export function makeBatches(questions: NormalisedQuestion[], size = BATCH_SIZE): BatchQuestion[][] {
  const usable = questions.filter((q) => q.status !== "rejected");
  const all: BatchQuestion[] = usable.map((q, i) => ({ id: questionId(i + 1, q.sourceRef, plainText(q.stem)), position: i + 1, question: q, figure: null }));
  const batches: BatchQuestion[][] = [];
  for (let i = 0; i < all.length; i += size) {
    let f = 0;
    batches.push(all.slice(i, i + size).map((b) => ({ ...b, figure: b.question.remoteImage ? `F${++f}` : null })));
  }
  return batches;
}

const REPLY_SPEC = String.raw`Reply with ONE JSON array inside ONE code block, so it copies cleanly. Nothing outside the block.
One object per question, in any order. Every id must appear exactly once.
If you run out of room, stop after a complete question. When I say "continue", reply in a NEW code block
with only the questions you have not answered yet.

For a solved question:
{
  "id": "q4-4848",
  "status": "solved",
  "answer": "C",
  "confidence": "certain",
  "topic": "M04",
  "subtopic": "M04.2",
  "concept": "Curved surface area of a cylinder",
  "intro": "Let's work through this step by step.",
  "formula": "$CSA = 2\\pi r h$",
  "variables": ["$r$ = radius (cm)", "$h$ = height (cm)"],
  "steps": [
    { "title": "Find the radius", "lines": ["$r = 8 \\div 2 = 4$ cm"] },
    { "title": "Substitute and compute", "lines": ["$CSA = 2 \\times \\frac{22}{7} \\times 4 \\times 14$", "$CSA = 352$ cm²"] }
  ],
  "why": "The curved surface of a cylinder is 2πrh. With r = 4 cm and h = 14 cm that gives 352 cm².",
  "wrong": {
    "A": "This is the area of one circular end, not the curved surface.",
    "B": "This uses the total surface area, which wrongly adds both circular ends.",
    "D": "This puts the diameter into the formula in place of the radius."
  },
  "hint": "Start by writing the formula for curved surface area.",
  "tip": "Halve the diameter before substituting.",
  "figure_alt": "",
  "illustration": "",
  "issues": []
}

Field rules
- "answer": one letter. "confidence": "certain" or "likely".
- "topic" and "subtopic": a code from the list, or "none". A subtopic code must sit under your topic.
- "wrong": one entry for every option except the answer, and no entry for the answer.
- "figure_alt": only when a source figure is attached. Describe only what you can see: labels, values, shapes.
  Otherwise "".
- "illustration": "" normally. If a teaching diagram would genuinely help, say what it would show and why.
- Use "" for a text field that does not apply and [] for a list that does not apply.

For any status other than solved, give only: id, status, issues (a list saying exactly what is missing
or uncertain), and "alternatives": ["A","C"] for ambiguous or "best_guess": "B" for unsure.

IMPORTANT, maths inside JSON: every LaTeX backslash must be written twice, as in the example above
(\\frac, \\times, \\pi). A single backslash breaks the JSON.`;

export interface PromptInput {
  subjectId: string;
  subjectName: string;
  batchNo: number;
  batches: number;
  topics: TopicEntry[];
  batch: BatchQuestion[];
}

function topicBlock(topics: TopicEntry[]): string {
  if (!topics.length) return '(No topic list exists for this subject yet. Use "none" for every topic and subtopic.)';
  return topics.map((t) => [`${t.code}  ${t.name}`, ...t.subs.map((s) => `    ${s.code}  ${s.name}`)].join("\n")).join("\n");
}

function questionBlock(b: BatchQuestion): string {
  const q = b.question;
  return [
    `=== ${b.id} ===`,
    "Instruction: (none)",
    `Source figure: ${b.figure ? `${b.figure} (attached image)` : "none"}`,
    "Passage: (none)",
    "Question:",
    plainText(q.stem),
    "Options:",
    q.options.map((o) => `${o.key}. ${plainText(o.blocks)}`).join("\n"),
    `Content notes: ${q.reasons.filter((r) => r !== "figure_needs_media" && r !== "option_label_stripped").join(", ") || "none"}`,
  ].join("\n");
}

export function buildPrompt(input: PromptInput): string {
  const moduleKey = MODULE_FOR_SUBJECT[input.subjectId] ?? "recall";
  const figures = input.batch.filter((b) => b.figure);
  return `You are an expert Nigerian JAMB UTME teacher writing for 15 to 18 year old students.
Subject: ${input.subjectName}. ${input.batches > 1 ? `Part ${input.batchNo} of ${input.batches}, ` : ""}${input.batch.length} questions.

Solve every question yourself. No answer key is given. Use only what is supplied.

RULES
1. Do not invent a passage, quotation, table value, diagram or label. If something the question depends
   on is missing or unreadable, say so in the status and stop on that question.
2. A question is "solved" only if exactly one option is defensibly correct and everything needed is
   present. Otherwise use missing_context, ambiguous or unsure (see STATUS).
3. Before writing, silently check that your answer matches your reasoning, the arithmetic is right, and
   no other option also works.
4. Never write an option letter inside explanation text. Refer to options by what they say. Letters
   appear only as keys such as "answer" and the keys of "wrong".
5. Do not write "The correct answer is...". The app adds that line.
6. Plain language. Say "so" and "this means", not "hence" or "thus". No filler.
7. Maths goes in $...$ using LaTeX. Currency is the naira sign directly, for example ₦500.
8. Marks: **bold** for the key term, *italic* for secondary terms. No other markup and no HTML.

STATUS
solved           one unique correct option, everything needed is present.
missing_context  something required is absent. Say exactly what in "issues".
ambiguous        more than one option is defensible. List them as "alternatives".
unsure           everything is present but you cannot verify a unique answer. Give "best_guess".
                 A best guess is never used as the answer.

TOPICS
Choose from this closed list. Give the code, or "none" if nothing fits. Never invent a code.
${topicBlock(input.topics)}

${MODULE_TEXT[moduleKey]}

QUESTIONS

${input.batch.map(questionBlock).join("\n\n")}
${
  figures.length
    ? `
FIGURES
Images ${figures.map((f) => f.figure).join(", ")} are attached to this chat, in that order. Look at each image before
answering its question. If an image is missing or you cannot read it, use missing_context.
`
    : ""
}
OUTPUT
${REPLY_SPEC}
`;
}
