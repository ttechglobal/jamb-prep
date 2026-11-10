/**
 * Short subject modules for the enrichment prompt. Each covers only what differs by subject.
 * They are data, versioned with the prompt, so a wording change is one edit and one version bump.
 */

export type ModuleKey = "calc" | "bio" | "econ" | "language" | "tables" | "recall";

export const MODULE_FOR_SUBJECT: Record<string, ModuleKey> = {
  mathematics: "calc",
  physics: "calc",
  chemistry: "calc",
  biology: "bio",
  economics: "econ",
  english: "language",
  literature: "language",
  accounting: "tables",
  commerce: "tables",
  government: "recall",
  crk: "recall",
};

const CALC = `SUBJECT MODULE: calculation subjects
- Decide per question. If a number has to be computed, give steps. If it is recall, a definition or a
  description, give "steps": [], "formula": "" and "variables": [].
- For calculations: list every given value with its symbol and unit first, name the equation, rearrange
  on its own line if needed, substitute one line at a time, compute one operation per line, then state
  the result with units. One operation per line.
- "formula" is the key named equation, for example $v = u + at$. "variables" decodes each symbol with
  its unit, one entry per symbol, and only when a formula is given.
- Chemistry: write every formula in maths, with braces for two digit subscripts: $\\text{H}_2\\text{SO}_4$,
  $\\text{C}_6\\text{H}_{12}\\text{O}_6$, $\\text{Ca}^{2+}$. Balanced equations use \\rightarrow.
- Keep the units the question uses. Do not round unless the question asks.`;

const BIO = `SUBJECT MODULE: Biology
- Keep it short and direct: name the biological term and give the mechanism in one sentence.
- Only genetics ratios, magnification and rate questions need steps. Everything else: "steps": [].
- For wrong options, name the exact mix-up (osmosis and diffusion, mitosis and meiosis, xylem and phloem).`;

const ECON = `SUBJECT MODULE: Economics
- Elasticity, national income, multiplier and index number questions need steps. Interpret the sign or
  size of the result in words. Definitions, market structures and policy questions: "steps": [].
- For wrong options, name the confusion (a shift of the curve versus a movement along it).`;

const LANGUAGE = `SUBJECT MODULE: English and Literature
- "steps" is always [], "formula" is "" and "variables" is [].
- A source underline or mark is kept as it is written. If the question refers to an underlined word or
  letters and the question text does not show which, use status missing_context. Never choose the target
  from the options.
- A short extract is valid context. Do not ask for the whole poem or book. A list of characters is not
  enough to say who spoke a quoted line.
- Comprehension questions need their passage. If the passage is not supplied, use missing_context.
- For a vocabulary or grammar question explain the rule or the meaning, then why each wrong option fails.`;

const TABLES = `SUBJECT MODULE: Accounting and Commerce
- Keep every label, amount, sign, date and column of any table exactly as supplied. Never add totals or
  answer figures to source data. If a cell or column is unclear, use missing_context and name it.
- Calculation questions need steps with the working for each figure. Theory questions: "steps": [].
- Write currency as the naira sign directly, for example ₦12,500.`;

const RECALL = `SUBJECT MODULE: Government and Christian Religious Knowledge
- "steps" is always [], "formula" is "" and "variables" is [].
- Explain the idea in one to three sentences. For wrong options, say what that option actually refers to,
  so the student learns the difference.
- Give a Bible reference only when you are certain of it.`;

export const MODULE_TEXT: Record<ModuleKey, string> = { calc: CALC, bio: BIO, econ: ECON, language: LANGUAGE, tables: TABLES, recall: RECALL };
