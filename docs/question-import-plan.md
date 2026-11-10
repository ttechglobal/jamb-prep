# Question import: the full plan

10 Nov 2026. A plan only. Nothing here is built. It builds on `myquest-import-design.md` and replaces its "Build order".

## 0. Correction: how import really works (10 Nov, from the owner)

Questions are **not** enriched by Claude Code or any service from inside the app. The real workflow is manual and has an AI step in the middle:

1. Fetch a paper from MyQuest in the admin page.
2. The page builds a **prompt plus the questions** and the owner copies it into an AI chat.
3. The AI returns, in one pass: the verified answer, a topic and subtopic, a full explanation, and **why each wrong option is wrong**.
4. The owner pastes the reply back. The page matches it to the questions, **previews** it and **checks for issues**.
5. Only then is anything saved.

What this changes in the plan:

- The tagging queue (Part 4 below) is **dropped**. Tagging happens in step 3. The prompt must carry a **closed list of topics per subject**, so Commerce and Mathematics need their topic lists before they can be imported.
- The app's job is: build the prompt, accept the pasted reply, merge it by id, validate it, preview it, and save. The quality of **the prompt and the reply format** now decides the quality of the bank, so they are designed first, from what the first app learned.
- The "AI tagging raises the rights question" decision is moot: content already goes to an AI chat by design.
- Still open: draft-first landing, exams scope, extra subjects, the MyQuest rights note.

The full design of that AI step (prompt, reply format, parser, checks, build order) is in **`question-enrichment-design.md`**. Its build order replaces section 10 below. Everything else below still stands unless it conflicts with this section.

## 1. What we found before planning

1. **MyQuest and our bank are largely the same material.** For JAMB Physics 2025, 35 of the 40 MyQuest questions already exist word for word in the bank (the bank holds 38 for that paper). The five that are missing are exactly the five with a diagram, which the old importer could not take. So fetching a year we already hold mostly pays ₦10 to be told "duplicate".
2. **The bank cannot recognise its own rows by source.** Existing `source_ref` values are random UUIDs from the old app, not MyQuest ids. The only link between an old row and a MyQuest row is the question text (`content_hash`).
3. **Our subject list is thin and uneven.** 12 subjects, Geography hidden. Topics exist for 9. Commerce and Mathematics have none. English and Literature have 3 topics each (too coarse for frequency analysis).
4. **MyQuest lists 16 JAMB subjects for 2025.** 11 map to ours. Five do not: Fine Art, Yoruba, Computer Studies, Arabic Studies, The Lekki Headmaster (a literature set text, which belongs under Literature with a work record, not as its own subject).
5. **The bank is JAMB only.** `questions` has no exam column. MyQuest also lists WAEC, NECO, POST-UTME, GCE and GST.
6. **MyQuest gives no topics.** Everything topic-related is ours to do.
7. **The Physics paper's quality signals are weak.** No D answers in 40, generic wording. Both sources share this, so it is a property of the material, not of the importer.
8. **Hardcoded things to retire:** the subject map is a TypeScript object, the staging rows are computed on the fly and not stored, and nothing records who approved what.

## 2. Principles (from the first app's failures and what we just learned)

- Our list of subjects, topics and exams is the source of truth. MyQuest adapts to it, never the other way round.
- Fetch, review and publish are separate, and each can be repeated safely.
- Nothing reaches students without passing the same checks, and every row can be traced back to a paper, a page and a run.
- Everything is reversible: a bad import can be pulled out as one batch.
- Content decisions (rights, quality) are recorded, not assumed.

## 3. Part 1: our subject registry

**Goal:** one place that says which subjects we teach, how MyQuest's names map to them, and what is missing.

- Keep `subjects` as the master list. Add a state per subject: `live` (students see it), `building` (we are filling it), `planned`. This replaces the single `active` flag. Geography becomes `planned`.
- New table `provider_subjects`: `provider`, `exam`, `provider_name`, `subject_id` (nullable), `treatment` (`map`, `ignore`, `set_text`), `note`. Unique on provider, exam, name. Seeded from the 16 JAMB names:
  - 11 `map` rows (what is hardcoded today).
  - The Lekki Headmaster is `set_text`: it maps to Literature and carries a `prescribed_works` record, so those questions get a `work_id` and a book reference.
  - Yoruba, Computer Studies, Arabic Studies, Fine Art are `ignore` until you decide to add them.
- A name MyQuest returns that is not in this table shows on the import page as **needs a decision**, never silently ignored or guessed.
- New admin page **Subjects**: list with state, question count, topic count, years held, and its MyQuest names. Add or hide a subject, edit the mapping.
- Coverage and Import read this table instead of the TypeScript map. Coverage then also shows subjects with zero questions, so "what we do not have" is visible.

## 4. Part 2: the taxonomy (topics) that import and analysis depend on

- A question can only be tagged to a topic that exists, so topics come first.
- Gaps to close before tagging: **Commerce and Mathematics have none**, English and Literature are too coarse. Draft each from the official JAMB syllabus, reviewed by you, then loaded as data.
- Tagging is a **separate stage after import**, not part of it. Imported questions land untagged. A tagger proposes a topic and subtopic from the closed list (or "none fits"), and you approve in bulk with a sample check.
- Who does the tagging is a decision (section 11). The cheapest and most private option is to run it here, in batches, with proposals saved to a file that the admin page loads.
- The Topic frequency page already ignores untagged rows and says how many it left out.

## 5. Part 3: staging that persists (steps 1 to 3, made real)

Today the dry run is recomputed on every view and nothing about a row is remembered. Change that.

- On a successful fetch, store the normalised rows in `question_import_rows`: paper, page, provider id, normalised content, reasons, `payload_hash`, normaliser version. Re-running normalisation after a rule change updates rows that have no human decision and flags any that would change.
- Add per-row **review state**: `ready`, `needs_review`, `approved`, `rejected`, `duplicate_of_bank`, `published`. A decision records who, when and a note.
- **Duplicate check against the bank at staging time.** An RPC computes the same `content_hash` the database trigger uses and reports which rows already exist. This is what would have told us Physics 2025 was 35 duplicates before any money was spent. Fuzzy near-duplicates (same stem, reworded) are flagged for review, never merged automatically.
- **Private staging bucket** for downloaded images, admin-only with short-lived links. The review page shows the image from there. Nothing goes to the public `question-media` bucket until publish.
- A per-paper summary: held count and reasons, key spread, duplicates against the bank, and **top-up count** (rows that are new). For a year we mostly hold, the useful number is "5 new, 35 already here".

## 6. Part 4: the review queue

One page, grouped by reason, so a person handles like with like.

| Reason | What the reviewer does |
|---|---|
| Diagram | Sees the image, writes the description (required), confirms it matches the question |
| Key versus explanation disagree | Sees both beside each other. Keeps, corrects the key (with a note), or rejects |
| Explanation admits a problem, placeholder or missing | Rewrites, accepts as is, or rejects |
| Duplicate of the bank | Confirms skip, or marks the older row as the one to replace |
| Near-duplicate | Same as above, with both shown |
| Missing table, extract or marked text | Supplies it, or rejects |
| Skewed key paper | Spot-checks a random sample of 10 against a source before releasing the paper |

- Bulk actions for the safe cases, for example "approve all ready rows in this paper".
- A key corrected by a person is stored with a note and the original, so it is never overwritten by a later re-import.

## 7. Part 5: publish

- A database function `publish_import_paper(paper)` that writes the whole paper in **one transaction** or none of it: question, solution, shared context and figure, `source_ref`, import row link. Skips duplicates the unique constraint would reject and reports them.
- **Lands as `draft`.** Students see only `published`. A second, deliberate step publishes an approved batch, after the sample check. This costs one click and removes the risk of a bad paper reaching students at the moment of import.
- Source figures are copied from the private bucket to `question-media` here, with the written description.
- Each publish is a **batch**: `question_import_batches` already exists. Add a batch id to rows so a batch can be **rolled back** (retire its questions) in one action. Sessions already answered keep working because rows are retired, not deleted.
- Afterwards: Coverage updates itself, and the Subject page shows the change.

## 8. Part 6: guarding cost and rights

- **Estimate before you spend:** the import page shows "about 3 pages, about ₦30, balance ₦1,570" and refuses when the balance would drop below a floor you set.
- **Bulk queue** for gaps: pick subjects and years from Coverage, see the total estimate, then fetch sequentially with a pause between papers. Progress is stored, a failure stops the queue, and a resume picks up where it stopped. Papers we already hold are not offered by default.
- **Rights gate.** There is still no confirmed permission from MyQuest to store, edit and ship this content, including offline and AI tagging. Plan a single recorded setting, "MyQuest content rights confirmed", with a date and note. Publishing and image upload stay blocked until it is on. Fetching and reviewing are not blocked.

## 9. Part 7: keeping other parts of the product in step

- **Offline packs** are built from published questions. Publishing or rolling back a batch must mark that subject's pack out of date, so the next pack build includes it. The pack build script is not written yet (see `offline-app-contracts.md`), so this is a rule to honour when it is.
- **Reports and reviews** (`question_reports`) can point at a question that gets replaced. Replacement keeps the question id where possible.
- **Analytics** are unaffected. Imports are admin-side only.

## 10. Build order

Each step is independently useful and ends with something you can check.

| # | Step | Ends with | Touches students? |
|---|---|---|---|
| 1 | Subjects registry: state column, `provider_subjects`, Subjects page, Coverage and Import read it | You edit the subject list and mappings; unmapped names are flagged | No |
| 2 | Duplicate check against the bank in the import page | Physics 2025 shows "35 already here, 5 new" | No |
| 3 | Persist staged rows, review states, private image bucket | Rows survive a refresh and show in a list | No |
| 4 | Review queue, starting with diagrams and key disagreements | The 5 Physics diagram questions can be described and approved | No |
| 5 | Publish as draft, batch id, rollback | The 5 land as draft in the bank, and can be pulled back | Only if published |
| 6 | Taxonomy for Commerce, Mathematics, deeper English and Literature | Topics exist for every subject | No |
| 7 | Tagging queue | Topic frequency fills in for the new subjects | No |
| 8 | Cost estimate, bulk queue, rights gate | A gap list fetched safely in one go | No |

Steps 1 to 5 prove the pipeline end to end on **one real paper** (the 5 missing Physics questions) before anything larger is fetched.

## 11. Decisions needed from you

1. **Exams:** JAMB only for now (recommended), with the other MyQuest exams visible but disabled and the staging tables already carrying the exam. Or add an exam column to questions now.
2. **Subjects:** which of the extra MyQuest subjects you want to add (Computer Studies, Yoruba, Arabic Studies, Fine Art), and whether Geography should be planned or dropped.
3. **Landing state:** draft first, then a deliberate publish (recommended), or publish straight away when a paper passes all checks.
4. **Tagging:** done here in batches with no outside service (recommended), or an outside AI service, which raises the rights question further.
5. **Rights:** do you have, or can you get, written permission from MyQuest? This blocks publish and image upload only.

## 12. Risks to keep in view

- If MyQuest and the old bank are the same material, the realistic gain from MyQuest is the **held diagram questions** and **years or subjects we lack**, not volume. Step 2 will show the real numbers per paper.
- Near-duplicates (reworded) will not be caught by an exact hash. Treat any large re-import with suspicion until a sample is read by a person.
- Topic tagging at scale needs human sampling. A wrong topic quietly corrupts the frequency analysis.
