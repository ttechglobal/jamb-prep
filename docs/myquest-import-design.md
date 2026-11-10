# MyQuest importer: design

10 Nov 2026. Built from the handover written by the first app's chat (legacy ExamPrep web/admin). Nothing here is built yet. MyQuest is the source for new questions. The existing 5,278 Exam Prep A1 rows are a separate, one-off load (see `question-bank-audit.md`).

## What the handover tells us

**Verified in the old code and captures**
- One endpoint, `POST https://api.myquest.com.ng/api`, Bearer key held server-side only.
- Catalogue chain: `get=exam`, then `get=exam_year_id`, then `get=subject`. Questions: `{exam, exam_year_id, subject, page}`.
- Row shape: `id` (integer), `question`, `options` (letter map), `correct_answer` (letter), `explanation`. No topic, passage, instruction or image fields in the four captures. Instructions and extracts are embedded in the stem.
- Question ids restart at 1 in every paper. Pages ran 40 rows in the captures.

**Never verified**
- The real HTTP envelope, rate limits, billing, and whether other fields (images, passages) ever appear.
- Licence terms. No agreement was found. Access is not permission to store, edit, redistribute, enrich with AI, or ship offline.

## Design rules (each one comes from a real failure)

1. **Paper is the unit.** A paper is exam + year + subject, resolved from the live catalogue, never guessed. A paper publishes whole or not at all.
2. **Identity is `paper + provider id`.** Stored as `source_ref = mq:{exam}:{year}:{subject}:{id}`, unique in the database. Never a bare provider id.
3. **Fetch is separate from interpretation.** Raw pages are stored first (restricted, admin only). Normalising and validating run on stored pages, so rules can change without paying for or repeating a fetch.
4. **Reconcile before anything moves on.** Reported total, page count, unique page hashes and unique ids must agree. A short or repeated page marks the paper incomplete.
5. **Dry run uses the same path as publish.** It stops before the final write and reports.
6. **Durable resume.** Progress lives in the database per page, not in the browser. Retry with backoff and `Retry-After`. Stop on auth failure or shape change.
7. **Key is bound to an option, and reviewed with its explanation.** Store the correct option text next to the letter in staging. A key changed in review needs the explanation revisited.
8. **Never let the AI decide the key.** Enrichment may propose, never overwrite. A "missing context" answer is allowed and holds the row.
9. **Context is never dropped.** Instruction, extract, attribution and figure travel to the student. The extract goes into `shared_contexts` only when the source clearly links questions to it, or a reviewer confirms.
10. **Diagrams are a gate.** A question that refers to a figure stays held until an image is attached and checked. Prose like "figure of speech" must not trigger it.
11. **Quarantine, don't delete.** Failures keep a reason code and a place in the review queue.

## How it maps to our schema

The v2 schema already fits most of this.

| Need | Existing | Add |
|---|---|---|
| Batch record | `question_import_batches` | run status, adapter and rule version, reconciliation summary |
| Per-row record | `question_import_rows` (`pending, valid, rejected, duplicate, imported`) | `paper_key`, `page`, `raw` payload hash, reason codes, proposed content, `review` state |
| Unique source | `questions.source_ref unique` | nothing |
| Duplicates | `questions.content_hash unique` (ignores option order, includes context) | fuzzy matches go to review, never auto-merge |
| Passages | `shared_contexts` | only from verified links |
| Answers | `question_solutions` | written in the same transaction as the question |
| Draft vs live | `questions.status` and the published-needs-four-options constraint | nothing |

New tables: `import_papers` (paper key, catalogue snapshot, reported count, state) and `import_pages` (paper, page, attempt count, body hash, received count, raw reference). Raw payloads live in a private storage bucket or a locked table, never in logs.

## Stages

1. **Discover.** Pull the catalogue, store a snapshot, map each provider subject to our `subject_id` once, by hand, in a reviewed mapping.
2. **Fetch.** Walk pages for a paper, storing each page with its hash before moving on. Reconcile.
3. **Normalise.** Deterministic only: options to A to D by order with stable canonical ids, key resolved to option text, safe markup and tables kept, instruction and quoted-target extraction, figure detection. Output goes into our block format (`lib/content/types.ts`).
4. **Validate.** Four usable distinct options, key points at a usable option, no embedded A/B/C/D labels, no empty stem, no placeholder explanation, figure present if referenced, duplicates by `content_hash`.
5. **Review.** Held rows with reasons: key versus explanation disagreement, missing context, missing figure, near duplicate, unknown topic.
6. **Publish.** One transaction per paper: questions, solutions, contexts, import rows updated, coverage derived from rows, not incremented separately.

## Report per paper (dry run and publish)

Expected, fetched, staged, duplicate, rejected, held (by reason), ready. Then on publish: inserted, unchanged, failed. Counts must add up or the paper does not publish.

## Open questions for you

1. **Rights.** Do you have, or can you get, written permission from MyQuest to store, edit and ship these questions, including offline and AI enrichment? This blocks migration, not building.
2. **Do we still need MyQuest now?** The 5,278 A1 rows already cover 11 subjects. What does MyQuest add: newer years, subjects we lack (Geography, hidden), or more volume?
3. **Topics.** MyQuest gives none. Tag from our curriculum by AI with review, or leave untagged until reviewed?
4. **Where the admin lives.** An `/admin` page like the old one, or a script first and the page later? Recommendation: script first, so the pipeline is proven before any interface.

## Build order

1. Capture 4 real responses (a multi-page paper, a one-page paper, a no-data case, an error) and commit them as fixtures.
2. Migration for the staging tables.
3. Fetch with reconcile, plus tests for 429, 5xx, bad JSON, repeated page, short page.
4. Normalise and validate with the legacy fixtures (underline, quoted targets, tables, label stripping).
5. Dry run report.
6. Review queue.
7. Publish transaction, then a pilot on one paper, checked in practice, mock and the offline app.

## Verified against the live API (10 Nov 2026)

First real calls, made by `npm run mq:fetch`. These replace the "unverified" items in the handover.

- Envelope: `{success, exam, exam_year_id, subject, call_type, old_balance, charges, new_balance, data: {questions, pagination}}`. Questions are nested under `data`.
- **Billing is per call.** A question page cost ₦10 and the response reports the account balance. Retries and re-fetches cost money, which is why raw pages are stored once and reused.
- Catalogue: `get=exam` returns plain strings (GCE, GST, JAMB, NECO, POSTUTME, WAEC). JAMB has 28 years (1999 to 2026). JAMB 2025 lists 16 subjects, including The Lekki Headmaster, Computer Studies, Yoruba, Arabic Studies and Fine Art, which our bank does not have yet.
- Year ids are the year as a string (`"2025"`). Subject names are used verbatim, spaces included.
- A questions row has a seventh field the first app never recorded: **`image`**. In JAMB 2025 Physics, 5 of 40 rows carry one. It is `https://api.myquest.com.ng/api/image.php?token=...`, a token URL. Treat it as perishable and private: download it at fetch time, check it, and store it in our `question-media` bucket. Never link to it from the app.
- JAMB 2025 Physics came back as one page of 40 rows (`per_page` 40, `total_pages` 1) and reconciled as complete.
- Raw responses contain the account balance and image tokens, so they stay in `data/imports/` (gitignored) and in the admin-only `import_pages` table.

## Built so far

- `lib/myquest/client.ts` and `lib/myquest/reconcile.ts`: client with retry, backoff, Retry-After, typed errors, tolerant parsing, page walking and reconciliation.
- `scripts/myquest-fetch.mjs` (`npm run mq:fetch`): catalogue and paper fetch, resumable from stored pages, no database.
- `tests/myquest.test.mjs` (`npm run mq:test`): 13 tests covering the first app's failures.
- `supabase/migrations/20261110000003_myquest_staging.sql`: `import_papers`, `import_pages`, and paper scoping on `question_import_rows`. **Written, not applied.**
