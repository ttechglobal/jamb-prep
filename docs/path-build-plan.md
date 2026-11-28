# Path: build plan

Status: plan only, nothing built. Design is on the canvas (https://claude.ai/artifact/SGPmvk2bxhPS6k3q3pyFfk). Question supply is in [path-question-audit.md](path-question-audit.md).

## What exists today that we build on

- `practice_sessions` (config jsonb, mode, correct_count) and `practice_answers` (user, question, is_correct, answered_at). Every mode already writes these.
- `private.pick_questions(user, subject, topic, count)` already puts questions the student answered in the last 14 days last, and removes same-content duplicates.
- `get_topic_trends()` already reads 14 days of answers per topic and feeds "From your recent practice".
- `start_session` takes a single `topicId` today. It has a rate limit and validates subject and topic.
- Guests are anonymous auth users (`private.is_guest()`), so a guest's rounds keep their user id when they register. To confirm in phase 1, because it decides whether guests can start a path.
- Analytics event names are whitelisted in SQL (`20261122000002_track_event_names.sql`), so new events need a migration.

## Design decisions to carry into the build

1. A path step is a **unit**: a named group of one or more topics, held in data, each with 17 or more questions (Maths: 13 units from 23 topics).
2. Stars are **earned and kept**. They are never recomputed away. "Revisit" is a live flag on top.
3. Evidence comes from **any mode**. No separate answer table.
4. Nothing is locked. "Next up" is a suggestion.
5. Subjects with no units show "Coming soon". No code change needed when units are added.

## Data model (one migration, not applied until you approve)

| Table / function | Purpose |
|---|---|
| `path_units` | `id, subject_id, slug, name, sort_order, active`. `sort_order` is syllabus order. |
| `path_unit_topics` | `unit_id, topic_id`. A topic belongs to one unit. |
| `path_stars` | `user_id, unit_id, stars (0 to 3), star1_at, star2_at, star3_at`. Written only by the server. |
| `get_path(subject)` | Per unit: name, question count, stars, revisit flag, answers and days so far, section number. Orders by question count for "Most asked first". |
| `private.update_path_stars(user, session)` | Called when a session is submitted. For each unit whose questions were answered, applies the star rules and returns before and after. |
| `pick_questions` | Takes `topic_ids uuid[]`. For path rounds, never-answered questions first, then oldest-answered, with options reshuffled on repeats. |
| `start_session` | Accepts `unitId` (one unit) or `unitIds` plus `checkpoint: true` (mixed check of 10 across a section). Validates they belong to the subject. |
| Session reward | Gains `path: { unitId, starsBefore, starsAfter, nextUnitId }` so the result screen needs no extra call. |

Seed: the 13 Maths units from the canvas. Order and names are data, so a row edit changes them.

## Star rules (starting values, in one place in SQL)

- **1 star:** a path round on the unit with 6 of 10 or better.
- **2 stars:** after the star-1 day, at least 10 answers on the unit on later days, at 70% or better. Any mode counts.
- **3 stars (Solid):** at least 7 days after star 2, at least 10 more answers, at 80% or better.
- **Revisit:** unit has 1 or more stars, 8 or more answers in the last 14 days, under 60%.
- **Mixed check:** counts as answers on each unit it touches. A section's check is "done" once one has been submitted for it.

Thin units (under 20 questions, only the last Maths unit) repeat sooner. Stars then rely on recent accuracy, not on never having seen the question.

## Phases

| # | Phase | Contents | Size |
|---|---|---|---|
| 0 | Decide | Confirm units, star values, nav, guest rule (questions below). | small |
| 1 | Backend | Migration above. Extend `scripts/check-bank.mjs` (rolled-back transaction) with a scenario: fake answers on different days, assert star 1, 2, 3 and Revisit. Add analytics names. | medium |
| 2 | Path screens | `lib/path/` (types, rpc client), `components/path/` (trail, node, topic sheet), `app/(main)/path/page.tsx`. Start a round from the sheet. Result screen reads `reward.path`. | medium |
| 3 | Entry points | Onboarding step 4 (stored as `profiles.path_mode`), Home "Your path" card, bottom-bar Path tab. Behind one flag so it ships dark. Hide partners behind a flag in the same pass. | small |
| 4 | More subjects | Group Physics, Chemistry, Biology, Accounting, Commerce, Economics topics into units with the same method and seed them. A small admin screen to edit units later. | small per subject |
| 5 | Desktop and Progress | Two-column path, centred sheet and result, Progress page showing stars per subject. | medium |
| 6 | Read page | Separate project: topic-to-EXL mapping table, server route that fetches and caches the EXL catalogue, free and paid gating on the server (the EXL API is public), reader screens. | large |

English, Literature, CRK and Government wait for re-tagging (see the audit). Phase 6 does not block the path.

## Risks

- **Star rules feel wrong with real data.** Mitigation: values live in one SQL function and in `check-bank`, so tuning is a one-line migration. Watch the share of students who reach 2 stars.
- **`get_path` cost.** It aggregates a user's answers by unit on every open. The existing `practice_answers_user_idx` helps. Measure before caching.
- **Unit grouping quality.** Grouping is by question count, not by what students find related. Review each subject's groups before seeding.
- **Applying migrations.** Earlier migrations here were reviewed and applied by hand (`db:push`). This one follows the same rule: written and checked locally, applied only when you say so.

## Open decisions

1. Are the 13 Maths units right, including the three small combined ones?
2. Star cut-offs (6/10, 70%, 80%, 7 days): keep as starting values?
3. Bottom bar: Practice, Path, Read, Games, Ranks, with Progress behind the level card?
4. Can guests start a path before signing up? It depends on the phase 1 check above.
5. Ship the path to everyone at once, or behind a flag for a few students first?
