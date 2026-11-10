# Question enrichment: the improved design

10 Nov 2026. Design only, nothing built. Based on the first app's handover (the manual "copy a prompt into an AI chat, paste the reply back" workflow) and on our v2 content format (`lib/content/types.ts`).

## 1. The workflow stays the same

1. Fetch a paper. The app normalises it (`lib/myquest/normalise.ts`) and holds anything it cannot take.
2. The app **builds the prompts** and the admin copies each into an AI chat.
3. The AI returns the verified answer, topic, explanation and why each wrong option is wrong.
4. The admin pastes the reply back. The app **parses, merges, checks and previews**.
5. Only after review does anything save. It lands as **draft**.

No model is called from the app. Which AI chat is used is the admin's choice, and the app records it.

## 2. What the handover showed was wrong, and the fix

| Problem in the first app | Fix |
|---|---|
| The prompt is several thousand words, with the same long boilerplate and examples repeated for every batch | A short core prompt plus one short subject module. Roughly a quarter of the length, so more of the AI's attention goes on the questions |
| The prompt contradicts itself: "No bold" in one place, bold required in three. The calculation example omits a wrong option while the rules demand all of them | One rule per thing. Examples are checked by a test against the reply parser, so a contradiction fails a build |
| The AI writes "The correct answer is **C: text**" and the app also stores the key, so the two can disagree | The AI never writes the answer sentence or any option letter in prose. The app builds the header from the stored key and option text |
| Prose mentions letters ("B is wrong because…") | Prose refers to options by their content. Letters only appear as field names, so shuffling options later is safe |
| One prompt for the whole paper, no splitter, no limit | The app splits a paper into batches of **10 questions** (configurable) and tracks which batches are done. A paper is 4 prompts |
| One truncated or malformed reply loses the whole array | Each question is its own section. A cut-off reply still yields every complete question, and only the missing ones are re-requested |
| JSON needs every LaTeX backslash doubled, so `\frac` becomes `\\frac`, the most likely cause of bad replies | The reply is tagged plain text, not JSON. Maths is written as normal LaTeX inside `$...$` with single backslashes |
| Global clean-up of quotes, entities and dashes before parsing can corrupt content | The parser never rewrites content. It tolerates only a surrounding code fence and stray text outside the reply, and tells the admin exactly what it ignored |
| The match key was a copied source id plus the first 15 words, which the AI often mangled | Each question gets a short batch id with a check code, for example `q3-a3f9`. A wrong code is detected immediately, with no snippet needed |
| The AI had to say "I cannot see the diagram" because URLs are not images | The app lists each source figure as an **attachment** (F1, F2…). The admin attaches the image to the chat so the AI really sees it, and it proposes a description for the human to approve |
| Every prompt carried 1,500 words of illustration rules, even when no figure was wanted | Illustrations are a **separate optional second prompt**, only for questions flagged as needing one. The SVG it produces passes the same safety check as source images (`lib/myquest/media.ts`) |
| "If unsure, still guess" versus "never guess when context is missing" | A single rule: a unique defensible answer, or a status saying why not. A best guess is returned separately and never publishes |
| Topic list was names only, matched afterwards by fuzzy text, which can quietly pick a wrong subtopic | A **closed list with codes** (`M04`, `M04.2`). The AI returns a code or `none`. The app checks the code exists in that subject. No fuzzy matching |
| Disagreement between the provider key and the AI key was only noticed at preview | A targeted **adjudication prompt** is generated for disputed questions only, showing both keys and asking for evidence. A human still decides |
| No record of which prompt or model produced an explanation | Every saved question records prompt version, subject module version, batch and the AI model name the admin enters |

## 3. The prompt the app builds

Assembled from parts, so each can be edited and versioned as data.

### 3.1 Core (the same for every subject)

```text
You are an expert Nigerian JAMB UTME teacher writing for 15 to 18 year old students.
Subject: {{SUBJECT}}. Batch {{BATCH_ID}}, {{COUNT}} questions.

Solve every question yourself. No answer key is given. Use only what is supplied.

RULES
1. Do not invent a passage, quotation, table cell, diagram or underlined word. If something the
   question depends on is missing, say so in the status and stop on that question.
2. A question is "solved" only if exactly one option is defensibly correct and everything needed
   is present. Otherwise use: missing_context, ambiguous or unsure (see STATUS).
3. Before writing, silently check: your answer matches your reasoning; the arithmetic;
   that no other option also works.
4. Never write an option letter in explanation text. Refer to options by their content.
5. Do not write "The correct answer is...". The app adds that line.
6. Plain language. Say "so" and "this means", not "hence" or "thus". No filler.
7. Maths in $...$ with ordinary LaTeX, single backslashes. Display maths on its own line in $$...$$.
   Currency is the naira sign directly, for example ₦500. A literal dollar is written \$.
8. Chemical formulas in $...$ too: $\text{H}_2\text{SO}_4$, $\text{Ca}^{2+}$.
9. Marks: **bold** for the key term, *italic* for secondary terms, <u>underline</u> only to copy a
   source underline. Do not use any other markup or HTML.

STATUS
solved           one unique correct option, all needed material present.
missing_context  something required is absent (say exactly what, in "issues").
ambiguous        more than one option is defensible (list them in "alternatives").
unsure           everything is present but you cannot verify a unique answer.
                 Give your best guess in "best_guess". It is never used as the answer.

TOPICS
Choose from this closed list. Return the code, or "none" if nothing fits. Never invent a code.
A subtopic code must sit under the topic you chose.
{{TOPIC_LIST}}

{{SUBJECT_MODULE}}

QUESTIONS
{{QUESTIONS}}

{{FIGURES_NOTE}}

OUTPUT: follow the REPLY FORMAT exactly, inside ONE code block, so it copies cleanly.
{{REPLY_FORMAT}}
```

### 3.2 How each question is written into `{{QUESTIONS}}`

```text
=== q3-a3f9 ===
Instruction: (none)
Source figure: F1 (attached image)        <- or: none
Passage:
(none)
Question:
Evaluate (0.025 × 0.040) / 0.005 to 3 significant figures.
Options:
A. 0.2
B. 0.02
C. 0.002
D. 0.0002
Content notes: none
```

- The provider key and provider explanation are **never** included, so the AI really solves blind.
- `Content notes` carries the normaliser's flags (for example "an underlined word is referred to but none is marked"), so the AI does not rediscover them.
- Tables are written as pipe tables, with empty cells kept.

### 3.3 Subject modules (short, data, versioned)

Each is 150 to 300 words and covers only what differs:

| Module | Subjects | Covers |
|---|---|---|
| calc | Mathematics, Physics, Chemistry | When to give steps (any question with numbers to compute) and when not. One operation per line. Formula and variable rules. List given values with units first. Chemistry adds the formula and subscript rules. |
| bio | Biology | Short and direct, mechanism in one sentence. Genetics and magnification need steps. |
| econ | Economics | Elasticity and national income need steps. Interpret the sign. |
| language | English, Literature | Instruction handling and underline rules (section 5). A short extract is valid context. Do not require the whole text. |
| tables | Accounting, Commerce | Preserve every label, sign, column and empty cell. Never add totals to source data. |
| recall | Government, CRK | Explain the concept in two sentences. No steps. |

Examples live in the module, **one** worked example per shape, and a test parses them.

### 3.4 Reply format (tagged text, not JSON)

```text
#REPLY v1 batch=B7K2
#ITEM q3-a3f9
status: solved
answer: A
confidence: certain
topic: M04
subtopic: M04.2
concept: Decimal arithmetic
intro: Let's work through this step by step.
formula: none
variables: none
steps:
- Multiply the top
  $0.025 \times 0.040 = 0.001$
- Divide
  $\frac{0.001}{0.005} = 0.2$
- Write to 3 significant figures
  $0.200$
why: The top multiplies to 0.001 and dividing by 0.005 gives 0.2, which is 0.200 to 3 significant figures.
wrong.B: 0.02 is ten times too small.
wrong.C: 0.002 is a hundred times too small.
wrong.D: 0.0002 is a thousand times too small.
hint: Multiply the numerator first, then divide by 0.005.
tip: 0.025 times 0.04 is 25 times 40 with six decimal places.
split: none
figure_alt: none
illustration: none
issues: none
#END
#ITEM q4-77c1
status: missing_context
issues: The question refers to the passage above, but no passage was supplied.
#END
#ENDREPLY
```

Grammar:

- `#REPLY`, `#ITEM <id>`, `#END`, `#ENDREPLY` are the only structural lines.
- Fields are `name: value`. A field can continue on following lines, indented by two spaces.
- `steps:` is a list: `- Title`, then indented lines.
- `wrong.X` has one entry for every option except the answer. The parser checks the set is exactly the other three.
- `status` other than `solved` needs only `status` and `issues`. `alternatives: A, C` for ambiguous. `best_guess: B` for unsure.
- `none` means deliberately empty. A missing field is an error, not a silent blank.

Why not JSON: no backslash doubling, a truncated reply keeps every complete item, a malformed item does not spoil its neighbours, and the format is easier for a chat model to produce consistently. The parser still reads the pasted text strictly.

### 3.5 Text becomes v2 blocks in code

The AI never writes block JSON. A deterministic converter turns each field into our types:

- Blank line makes a paragraph. `$...$` makes `{math}`. `$$...$$` makes a `math` block.
- `**x**` bold, `*x*` italic, `<u>` underline, `<sup>`, `<sub>`. Anything else is dropped and flagged.
- `why` becomes `Solution.answer`. `concept` is a string. `intro`, `formula`, `variables`, `studyTip` become blocks. Each step becomes `{title, blocks}`. `wrong.X` becomes `wrongOptions`. `hint` goes to `question_solutions.hint`.
- The student-facing header ("The correct answer is…") is built from the stored key and the option text.

## 4. The pipeline and its checks

**Parse (strict):** reply envelope present and batch matches. Every requested id answered exactly once, no unknown ids, check code valid. Each item has every required field for its status. Reports what it ignored.

**Merge and compare:**
- AI answer versus provider key. If different, the question is **disputed** and cannot be approved until a person decides. An adjudication prompt is offered for those questions only.
- Option text is never taken from the reply.
- A changed key invalidates the explanation and approval.

**Content checks (block saving):**
- Not `solved`, or `unsure` with only a best guess.
- Topic or subtopic code not in the subject's list, or subtopic under the wrong topic. `none` is allowed but listed.
- Missing wrong-option entries, or one that is empty or only says "incorrect".
- Prose that names an option letter. A "correct answer is" sentence.
- A step that is not valid LaTeX (rendered in a test pass), unbalanced `$`, forbidden markup.
- Source figure unresolved, or its description empty.
- Every check in `normalise.ts` still applies.

**Warnings (reviewer decides):** confidence `likely`, explanation very short or very long for the type, steps on a recall question or none on a numeric one, topic `none`, an illustration requested.

**Overrides** carry a note, are tied to a hash of the content and key, and expire when either changes. The reviewer is recorded.

**Preview:** the question as a student sees it (the real `StudentQuestionContent` renderer), the provider key beside the AI key, the explanation as it will appear, the topic path in words, and the issues.

## 5. English and Literature details

- Instruction text: the AI may **propose** a standard instruction ("Choose the option nearest in meaning to the underlined word") only when the question type is clear, marked `inferred`. A reviewer accepts it. It is never presented as source text.
- Underlines: when a question refers to an underlined word and the normaliser found exactly one quoted target, it is marked in the question and the AI is told so. If none can be found, the AI returns `missing_context`. It never chooses a target using the options.
- Passages: an extract is valid even when short. A character list is not enough to identify a speaker.
- Splitting a long stem into instruction, passage and question: the app pre-numbers the segments (`s1`, `s2`…) and the AI returns `split: instruction=s1; reading=s2,s3; stem=s4`. The app reassembles, so the split cannot lose or change text. Phase 2.

## 6. Second prompts, generated only when needed

| Prompt | When | Result |
|---|---|---|
| **Fix reply** | Parse errors or missing ids | Lists exactly what is wrong and asks the AI to resend only those items in the same format |
| **Adjudicate** | AI key differs from provider key | Shows both keys and the question. Asks for the strongest evidence for each and a final answer. A human decides |
| **Illustration** | Question flagged `illustration: needed` | A focused brief for one SVG, the labelled values supplied, and a hard rule to draw nothing unsupported. The SVG is checked by the media safety check and approved by a person |
| **Figure description** | A source figure is attached and the admin wants help | The AI describes only what is visible. The reviewer edits and approves. The description becomes the required alt text |

## 7. What the app stores for provenance

Add to each import row and batch: prompt version, module version, AI model name (typed by the admin when pasting), batch id, parse warnings, and every override with reviewer and time. This makes it possible to find and redo every question produced by a prompt version later found faulty.

## 8. Data and UI changes this needs

- **Topics for every subject, with codes.** Commerce and Mathematics have none. English and Literature are too coarse. The prompt cannot work well without them, so this precedes import for those subjects.
- Tables: `prompt_modules` (name, version, text), a place for the reply and its parse result per batch, and provenance columns above.
- Import page: after the paper adds up, a **Batches** section. Each batch has Copy prompt, a paste box, a status (waiting, parsed, has problems, reviewed), and a preview. Figures list with Download and attach instructions.
- Review queue as in `question-import-plan.md`, now with the key-dispute and key-versus-explanation cases built in.

## 9. Build order (replaces section 10 of `question-import-plan.md`)

| # | Step | Ends with |
|---|---|---|
| 1 | Subject registry, mapping table, Subjects page | Our list drives Coverage and Import |
| 2 | Duplicate check against the bank | "35 already here, 5 new" per paper |
| 3 | Topic lists with codes for every subject (data work, reviewed by you) | Every subject has a closed list |
| 4 | Prompt builder: core, modules, question blocks, batches of 10, copy button | You can copy a real prompt for a real paper |
| 5 | Reply parser and converter, with tests built from real saved replies | Pasting a reply gives a preview |
| 6 | Checks, key comparison, adjudication and fix prompts | Problems are listed and each has a next step |
| 7 | Review and save as draft with provenance | The 5 Physics diagram questions go in as drafts |
| 8 | Publish and rollback | A reviewed batch goes live and can be pulled back |
| 9 | Illustration pass and figure descriptions | Optional extras |

Steps 4 and 5 are where the quality is won. Before building them, test the prompt and reply format by hand on one real paper in your AI chat, and adjust.

## 10. Decisions

1. **Tagged text reply instead of JSON** (recommended). The rest of the design does not depend on it, but it removes the largest known failure class.
2. **Batch size 10** to start. Measure truncation and quality, then adjust. The old limit was never measured.
3. **Illustrations as a separate second prompt** (recommended), instead of inside every prompt.
4. **Which AI chat do you paste into?** If it accepts image attachments, source figures get described from the real image. If it does not, figures stay human-described.
5. **Does the app need to enforce your tone rules** ("warm older sibling", no "hence")? They are in the prompt now. A check can flag banned words, or leave tone to the reviewer.

## 11. Honest limits

- The reliability numbers (batch size, truncation, time per paper, correction rate) were never measured in the first app. They are guesses until a paper is run by hand.
- A model solving blind can still be confidently wrong. The key comparison catches disagreement with the provider, not a case where both are wrong, so a sample of published questions still needs a human check.
- The handover's real replies were not preserved. The test cases for the parser have to be built from new replies.
