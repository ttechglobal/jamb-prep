# JAMB Prep — Build Plan (V1 pilot, V2-ready)

Status: **Draft for review** · 7 Nov 2026 · Source: *JAMB Prep Master PRD v1.0* + *UI/UX Design Draft v1.0*

This turns the PRD into a build plan. It makes architecture decisions for scale now, so V2–V5 can be added without rewrites. It also lists the decisions we need from you before each area gets built. Nothing here adds product features that aren't in the PRD. Where I recommend something the PRD doesn't specify, it is marked **[Rec]**.

---

## 0. Current approach: pages first, gamified UI (added 7 Nov 2026)

**Owner direction:** build and review every page first, on sample data, then connect real data. The UI should feel gamified but stay simple, so learning is fun. This updates the PRD and Design Draft in three places:

| Source said | New direction |
|---|---|
| XP is V3; "Battle, Learn, XP" not in V1 (this doc, section 1) | XP, levels, streaks, stars and a daily goal are in the V1 **UI**, running on local sample data. Battles and leaderboards stay out. Whether real XP ships in the pilot gets decided at the data stage. |
| "Avoid excessive gradients, decorative graphics" (Design Draft) | Still no gradients or clutter. Colour, chunky tactile controls and motion carry the game feel. All graphics are inline SVG/CSS, so nothing adds to data use. |
| Font: Plus Jakarta Sans only | Fredoka for headings, numbers and buttons. Plus Jakarta Sans stays for question text, so reading stays calm. |

**Rules for keeping it simple**
1. Every game element must answer "am I progressing?" No element exists only for decoration.
2. Quick Five stays above the fold on a 360px phone.
3. The Mock Exam stays serious: no combos, stars or confetti. It is a CBT simulation.
4. Practice scores and XP never imply a predicted UTME result. Target score is a goal, not a forecast.
5. All motion respects `prefers-reduced-motion`.

**Build sequence**

| Stage | Work | Done when |
|---|---|---|
| A. Foundation | Design tokens, fonts, chunky buttons, game components, game rules | Components render on every screen |
| B. Pages | Landing, auth, onboarding, practice, setup screens, question session, mock CBT, results, settings | Whole guest and student flow is clickable on sample data |
| C. Review | `/preview` gallery shows every screen at phone and desktop width | **Done: design approved by owner, 7 Nov 2026** |
| D. Data | Phases 3 to 5 in section 8 (Supabase, question migration, engine, admin) | UI unchanged; `lib/data` swapped |
| E. Harden | Phase 6 in section 8 | PRD quality gates pass |

**Instant-start flow (owner decision, 7 Nov 2026).** This replaces the earlier guest rules, including decision 4 in section 10.

1. Landing: Start Practising goes to `/start`.
2. `/start`: tap any subject and five questions begin. Nothing else to fill in.
3. Results: Practice again (back to the subject picker, with the last subject on top), Review answers, or create an account to save progress.
4. After sign-up only: name, four subjects (subjects tried as a guest are pre-selected), a target out of 100 per subject.

Guests get two rounds in this loop, then must create an account to continue. Starting a round uses it up, and the server enforces this. Subject Practice, Timed Practice, Mock Exam, the Practice home and settings need a finished account. The total target out of 400 is the sum of the four subject targets.

**Answering and review standards (all modes)**

- Instant feedback: tap to choose, change it freely, then press Submit to see the answer and explanation, then Continue.
- Review is a full-screen walk back through the questions (`/session/[id]/review`), showing the student's choice, the correct answer and the full explanation, with All and Missed filters. Results only links to it.
- The progress bar shows the question count. Streaks live in the header and results.

**Stage D progress (7 Nov 2026)**

- JAMB Prep has its own Supabase project (Frankfurt, `eu-central-1`), separate from Exam Prep A1. Credentials are in `.env.local`; `.env.example` lists what is needed.
- Done: schema, row-level security and the session engine are applied through `supabase/migrations`. Run `npm run db:push` to apply and `npm run db:test` to test (63 checks in a rolled-back transaction).
- Added beyond section 3: `player_progress`, plus `reward` on `practice_sessions`, so the approved XP, streak and level screens have real data; `passage` on `questions` for comprehension; `question_import_batches` and `question_import_rows` as the holding area for all bulk uploads. Streak days use Africa/Lagos time.
- Next: admin import and validation, connect the app to Supabase, then the question migration. Existing questions and future uploads use the same import path.
- Migration order: get the source table structure and about 20 samples first, then write the export query for that structure.

**Question content (7 Nov 2026, replaces the question columns in section 3).** The old bank is reference only. Questions are stored as ordered content blocks (`lib/content/types.ts`), and one renderer shows every subject (`components/content/`). Answers and solutions live in `question_solutions`, passages and shared tables in `shared_contexts`, and set books in `prescribed_works` with `work_assignments` by year. Figures are stored in the blocks and served from the `question-media` bucket. Subjects now include Accounting and CRK, and Geography is hidden until it has questions. Test bench: `/preview/content`. Export request for the old bank: `docs/old-bank-export-prompt.md`. Exports go in `data/imports/`, which is gitignored because they contain answer keys.

**Question bank loaded (7 Nov 2026).** 5,276 questions are published, and 796 are left out with reasons. See `docs/question-bank-audit.md`. Import: `npm run db:import` is a dry run, add `-- --apply` to load. Health check: `npm run db:check`. The app now runs on Supabase. Sample data and the /preview gallery are removed; `/preview/content` stays until the pilot. Next: confirm registration works, then run the AI answer review.

**Game rules (owner-set 7 Nov 2026, in `lib/game/rules.ts` and mirrored in the database):** +2 XP per correct answer, nothing for a wrong answer, +2 for finishing, +2 for three stars. Stars: 90% accuracy = 3, 70% = 2, 40% = 1. Daily goal: 15 questions. Levels get steadily longer, with titles Aspirant, Candidate, Scholar, Ace and Legend.

---

## 1. What we're building (V1 scope, locked from PRD)

| In V1 | Explicitly NOT in V1 |
|---|---|
| Landing, guest practice, auth (register/login/logout/recovery) | Battle, Learn |
| Onboarding (name, English + 3 subjects, target 0–400) | Ambassador dashboards, payments, commissions |
| Practice screen (default signed-in landing, no Home) | Advanced analytics / recommendations |
| Quick Five, Subject Practice, Timed Practice, Mock Exam* | Offline question packs / sync |
| Results + answer review + explanations | Push notifications (not a launch blocker) |
| Settings (profile, subjects, goal, account) | Leaderboard (optional — open decision) |
| PWA basics (manifest, icons, SW, install prompt) | |
| Minimal admin studio + question migration (launch gate) | |

\*Mock Exam in the pilot is an open decision (see §10).

**Verified UTME format (2026, official JAMB manual):** 4 subjects, Use of English compulsory. English has **60** questions, each of the other three has **40**, so **180** in total. Every question has options A–D. One **120-minute** block covers the whole exam. Each subject is scored out of **100**, for **400** total. The format must be re-verified before release, so these values live in a config table, not in code.

---

## 2. Architecture overview

```
 Browser / installed PWA (Next.js client, minimal JS)
        │  HTTPS
 ┌──────▼──────────────────────────────────────────┐
 │ Next.js App Router on Vercel                     │
 │  • Server Components render pages (low JS/data)  │
 │  • Server Actions / Route Handlers = API layer   │
 │  • Middleware: auth session refresh, route guard │
 │  • /admin route group (role-gated)               │
 └──────┬──────────────────────────────────────────┘
        │ supabase-js (user JWT, never service key on client)
 ┌──────▼──────────────────────────────────────────┐
 │ Supabase (new, independent project)              │
 │  • Postgres + RLS on every table                 │
 │  • SECURITY DEFINER RPCs: start/answer/submit    │
 │    session, scoring, onboarding                  │
 │  • Auth: email+password, anonymous (guests)      │
 │  • Storage: question images                      │
 └─────────────────────────────────────────────────┘
 Side services: Sentry (errors) · PostHog (product funnel) · Cloudflare Turnstile (bot protection)
```

### Stack
- **Next.js (latest stable) + TypeScript (strict) + Tailwind v4 + shadcn/ui.** This is the PRD's stack.
- **Supabase** with `@supabase/ssr`. Schema lives in versioned SQL migrations via the Supabase CLI. TypeScript types are generated from the DB.
- **Zod** validates every server-action input.
- **Serwist** [Rec] provides the service worker (maintained successor to next-pwa). `app/manifest.ts` provides the manifest.
- **KaTeX** [Rec] renders formulas, but only if the source questions contain math markup (open question). It is loaded lazily, and only on questions that need it.
- **Vitest** for unit tests (scoring, engine), **Playwright** for E2E at 360/390/desktop, and **pgTAP** [Rec] for RLS/RPC tests.
- **Hosting:** Vercel + Supabase. Supabase has no Africa region, so we pick the EU region with the lowest latency to Lagos [Rec: London `eu-west-2`]. Vercel functions go in the same region.

### Key design decisions for scale and correctness

1. **Correct answers never reach the client before they're earned.** Clients cannot `SELECT` the `questions` table directly. Questions come only from RPCs that strip `correct_option` and `explanation`. Feedback modes reveal the answer only after that question's answer is locked. Scoring runs in Postgres, inside `submit_session()`.
2. **Guests are real (anonymous) Supabase users** [Rec]. Supabase anonymous sign-in gives a guest a real `auth.uid()`, so the same RLS, session engine and tables work for guests and members. When the guest signs up, we *convert* that same user by attaching an email/password, so their practice history is kept automatically. This solves the PRD's "preserve guest session on signup" requirement with no merge logic. Anonymous sign-ups are protected by Turnstile + rate limits. Stale guest accounts get a scheduled cleanup.
3. **One session engine, many modes.** Every mode is a `SessionConfig`: `{ mode, subjects[], topic?, count, durationSec?, feedback: 'instant'|'end', navigation: 'linear'|'free', allowReview }`. Quick Five, Subject, Timed and Mock are presets of that config. Shared UI components: `QuestionView`, `OptionList`, `Timer`, `QuestionNavigator`, `SubmitDialog`, `ResultsSummary`, `AnswerReview`. Future Battle/Learn checks reuse the same engine.
4. **Server-authoritative sessions, resilient on bad networks.**
   - `start_session()` picks the questions and records a frozen snapshot (`practice_session_questions`), plus `deadline_at` for timed sessions.
   - Answers are **autosaved per question** (upsert), with an optimistic UI and a small retry queue in the client. A refresh, a dropped connection or a phone restart resumes the session exactly.
   - The timer shown on screen comes from `deadline_at`. The server rejects answers after the deadline plus a short grace period, and auto-finalises expired sessions on next read. This means the timer can't be cheated by changing the device clock.
5. **Random selection that stays fast.** Question picks filter on `(subject_id, topic_id, status)`, which has an index, then sample randomly. `ORDER BY random()` is fine at 5k–50k rows. If the bank grows much larger, we switch to a precomputed random key, and the RPC interface stays the same. The engine avoids repeating questions the user has seen recently.
6. **Exam rules as data.** A `exam_formats` table holds per-subject question counts, the duration and score scaling. If JAMB changes the format, we update one row, not ship a deploy.
7. **Cheap reads for static data.** Subjects and topics are cached in Next (`revalidateTag` when an admin edits them). Pages are Server Components by default, and client JS is only for interactive islands (the question session and forms). This keeps data use low and performance good on low-end Android phones.
8. **V2-readiness without building V2.**
   - We capture a `?ref=` code into a first-party cookie on the landing page in V1 and save it on signup. Attribution data starts accruing before the ambassador programme exists.
   - `profiles.role` and an `is_admin()` SQL helper are added now. `ambassador` is added to the role enum later.
   - An entitlements check (`has_access(user, feature)`) wraps premium-gated features from day one. In V1 it always returns true, so V2 subscriptions (Paystack [Rec], Nigeria-native) plug in without touching feature code.
9. **Growth path for practice data.** `practice_answers` is the fastest-growing table (≈ users × questions/day). It is indexed by `session_id` and `(user_id, answered_at)`. Leaderboards (V3) and analytics (V5) read from **rollup tables** (`user_daily_stats`) that are updated on submit, never from raw answers. Partitioning comes later, if volume warrants it.

---

## 3. Data model (V1)

All tables have RLS on. "Own" means `user_id = auth.uid()`.

| Table | Key columns | Client access |
|---|---|---|
| `subjects` | id, slug, name, is_compulsory, sort_order, active | read all |
| `topics` | id, subject_id, slug, name, sort_order, active | read all |
| `exam_formats` | id, name, total_duration_sec, rules jsonb (per-subject counts, max score), effective_from, active | read all |
| `questions` | id, subject_id, topic_id, body, options jsonb `[{key,text}]`, correct_option, explanation, image_path, year, source_ref (original Exam Prep A1 id), content_hash (unique, dedupe), status `draft/published/retired`, timestamps | **none** (RPC only); admin full |
| `profiles` | id (=auth uid), display_name, role `student/admin`, onboarded_at, referral_code_used, created_at | own read/update (role not updatable) |
| `student_subjects` | user_id, subject_id, target_score (0–100; exactly 4 incl. English, enforced in `complete_onboarding` RPC) | own read; write via RPC |
| `practice_sessions` | id, user_id, mode, config jsonb, status `in_progress/submitted/expired`, started_at, deadline_at, submitted_at, question_count, correct_count, score, per_subject jsonb | own read; write via RPC |
| `practice_session_questions` | session_id, position, question_id, subject_id | via RPC |
| `practice_answers` | session_id, question_id, user_id, selected_option, is_correct, answered_at, time_spent_ms | own read after submit; write via RPC |
| `question_reports` | id, question_id, user_id, reason, note, status, created_at | own insert; admin manage |
| `admin_audit_log` | id, admin_id, action, entity, entity_id, diff jsonb, created_at | admin only |

**RPCs (SECURITY DEFINER, validated, all check `auth.uid()`):** `complete_onboarding`, `start_session(config)`, `get_session(id)`, `save_answer(session, question, option)`, `submit_session(id)`, `get_results(id)`. Admin actions run in server actions that check `is_admin()`. The service-role key exists only on the server, for the import script and admin bulk operations.

---

## 4. App structure

```
jambprep/
  app/
    (marketing)/page.tsx            Landing
    (auth)/login, register, forgot-password, reset-password
    (app)/onboarding/               2–3 step flow
    (app)/practice/                 Default signed-in screen
    (app)/practice/subject/         Subject setup
    (app)/practice/timed/           Timed setup
    (app)/practice/mock/            Mock intro + rules
    (app)/session/[id]/             Shared question-taking screen
    (app)/session/[id]/results/     Results + review
    (app)/settings/
    admin/                          Overview, questions, reports, users (role-gated)
    manifest.ts, sw.ts
  components/ui/                    shadcn primitives
  components/session/               QuestionView, OptionList, Timer, Navigator, SubmitDialog…
  lib/engine/                       SessionConfig presets, client state machine, retry queue
  lib/data/                         Data-access layer (mock impl → Supabase impl, same interface)
  lib/supabase/                     server/client/middleware helpers
  supabase/migrations/, supabase/tests/, supabase/seed.sql
  scripts/question-migration/       export → validate → dedupe → import → verify
  tests/e2e/
```

The `lib/data` interface lets us build every screen against mock data first (as the PRD orders) and then swap in Supabase without touching any UI.

---

## 5. Question bank migration (launch gate)

1. **Read-only export** from Exam Prep A1 (a read-only DB role or CSV/JSON dump; the source is never modified).
2. **Validate** each record: the subject maps to a canonical subject, the topic exists or is flagged, there are exactly 4 non-empty options A–D, the correct answer is one of them, the explanation is present (optional), and any image is reachable.
3. **Normalise** HTML/markup, whitespace and math notation, and store the source id in `source_ref`.
4. **Deduplicate** on a hash of normalised body + sorted options. Near-duplicates are put in a review report.
5. **Import** into staging as `draft`, then promote passing records to `published`.
6. **Verify**: compare counts per subject/topic with the source, spot-check a random sample against source records, and run an automated round-trip check (re-score the source's correct answers through our engine).
7. **Output:** a migration report (imported / rejected-with-reason / duplicates). Rejected items go into the admin review queue.

---

## 6. Admin studio (minimal)

`/admin`, protected by middleware + `is_admin()` RLS.
- **Overview:** registered users, guests, sessions started/completed (today/7d), question counts by subject/status.
- **Questions:** search/filter (subject, topic, status, has-reports), edit with preview, publish/retire, CSV/JSON import (uses the same validator as the migration).
- **Reports:** queue of student question reports → resolve/edit.
- **Errors:** link-out to Sentry (no custom build).
- Every admin write goes to `admin_audit_log`.

---

## 7. Quality, security and observability

- **Security:** RLS on every table, enforced by an automated test. No service key in the client bundle (checked in CI). Zod on every input. Rate limits on auth and session creation. Security headers/CSP. Turnstile on guest sign-in and registration.
- **Accessibility:** keyboard-operable options (1–4 / A–D keys), visible focus, ARIA live region for feedback/timer warnings, contrast ≥ 4.5:1, 44px touch targets.
- **States per screen:** loading skeleton, empty bank, network error with retry, expired session, offline banner (honest: "you're offline — answers will sync when you reconnect", only for an in-progress session), PWA install eligibility.
- **Analytics events (PostHog):** `landing_view`, `practice_started{mode,guest}`, `practice_completed`, `signup_from_guest`, `question_reported`, `session_resumed`. These cover every metric in the PRD's launch-measurement list.
- **Performance budget [Rec]:** under 150 KB JS on the session route, LCP under 2.5 s on throttled 4G on a low-end Android.
- **CI (GitHub Actions):** typecheck, lint, unit, DB tests, Playwright smoke, and a Vercel preview deploy per PR.

---

## 8. Phased build (maps to PRD build order)

Each phase ends with a demo + "what was built / what remains / open decisions" note.

| Phase | Deliverable | Exit criteria |
|---|---|---|
| **0. Design sign-off** | Static mockups of every V1 screen at 360/390/desktop + design tokens | You approve palette, font, nav, hero, Practice hierarchy, question UI, results, guest prompt, mock nav |
| **1. Scaffold** | Repo, Next/TS/Tailwind/shadcn, tokens, lint/test/CI, Vercel preview, PWA manifest | Preview URL live, CI green |
| **2. Screens on mock data** | Landing → auth UI → onboarding → practice → setup screens → session UI → results → settings | Full guest + member flow clickable on mock data, E2E passing |
| **3. Supabase** | Project, migrations, RLS, RPCs, auth (incl. anonymous + upgrade), pgTAP tests | RLS/RPC tests green; answers unreadable before submit |
| **4. Question migration** (can start in parallel with Phase 2) | Export/validate/dedupe/import scripts + report | Counts reconcile, sample verified, rejects queued |
| **5. Wire engine + admin** | Swap data layer to Supabase, autosave/resume, timer, mock exam, minimal admin | Scoring tests pass, resume works after refresh/offline |
| **6. Harden + pilot** | Device testing (low-end Android, slow network), a11y pass, Sentry/PostHog, prod deploy | Quality gates from PRD all checked |
| **7. Post-launch** | Usage review, ambassador interest form, then V2 | — |

**On the 2–3-day target:** this is achievable only if the question export is accessible on day 1 and Mock Exam / Leaderboard can slip. My proposed **cut line**: if time runs short, the pilot ships with Quick Five, Subject and Timed Practice. Mock follows within days, using the same engine. Following the PRD, untested features are deferred, not shipped broken.

---

## 9. Testing priorities (highest risk first)

1. Scoring correctness, per mode, including Mock's per-subject /100 scaling to /400.
2. Answer secrecy: no API path returns `correct_option` before it should.
3. Session persistence: refresh, network drop and timeout auto-submit.
4. Guest → account upgrade keeps history.
5. Onboarding subject rules (English + exactly 3 valid others).
6. Mobile navigation and accessibility at 360px.

---

## 10. Decisions

### Resolved 7 Nov 2026 (owner: "use your recommendations")
| # | Decision |
|---|---|
| 1 | Draft palette accepted: primary #166534, accent #16A34A, bg #F8FAF9, text #17231C; font Plus Jakarta Sans |
| 2 | Desktop nav: compact top navigation (mobile: header + bottom nav only once there are ≥2 destinations) |
| 3 | Leaderboard: first post-launch feature, not in V1 |
| 4 | Superseded by the instant-start flow in section 0 |
| 8 | Mock Exam: built in V1 on the shared engine; ships in the pilot only if it passes tests, otherwise fast follow |
| 10 | Subjects: Use of English + exactly 3 others; no course-combination rules in V1 |

### Still open (need owner input)

5. What is the existing Exam Prep A1 database (Supabase, other Postgres, Firebase, MySQL)? Read-only access or an export? Not in the connected Supabase account (checked 7 Nov 2026: only `takk-entrance-exam` and `Rev Store` under PaveHq Ltd).
6. Do questions contain math/chemistry notation (LaTeX/HTML) or images/diagrams?
7. Are topics already tagged in the source data, and do they match JAMB syllabus topics?
9. Domain name; Vercel / Supabase / GitHub accounts.

**Later (V2, not blocking now):** pricing/free-tier entitlement, attribution window, fraud and refund rules, payout threshold, and guardian arrangements for minors.
