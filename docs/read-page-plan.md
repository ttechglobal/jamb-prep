# Read page: build plan

Status: built 2026-11-28 (phases 1 to 3, without the database tables). It reads EXL Learn live, so new lessons, topics and subjects show up on their own after a minute or so of caching. Nothing to change in this app when you publish more.

How it works: `lib/read/exl.ts` (server only) fetches and flattens the EXL catalogue and lessons and caches them; `app/api/read/*` hands them to the browser; `/read` is the hub and `/read/[id]` the reader. Lessons are matched to a JAMB topic by name in `lib/read/match.ts` (exact, then contains, then same key words). A lesson with no match still shows and offers practice for the whole subject. To pin a wrong or missing match, add a line to `OVERRIDES` there. There is no `read_topic_map` table, admin page, progress table or paywall yet. `EXL_API_BASE` overrides the address (default https://exllearn.vercel.app).

**Update (2026-11-28, later): Read & Learn API.** EXL added a second API for key-points ("Read & Learn") lessons: `/api/v1/read-and-learn` (catalogue), `/lessons/{id}/embed` (a full reader page) and `/lessons/{id}/content` (data, format `exl-keypoints-1`). Read now uses it: the catalogue comes from there and a lesson opens in EXL's own reader inside a frame, served through our `/api/read/embed/[id]` (cached, and the one place a free or paid check will go). If `/api/v1/read-and-learn` is not live on the EXL address (it returned 404 on the live site when checked, because it was not deployed yet), Read falls back to the older module catalogue and the notes renderer. EXL must be deployed with the new routes before Read shows Maths-free, Physics or the new Chemistry lessons live.

Caching: everything is cached on the server (Next `use cache`), at the edge (Cache-Control on `/api/read/*`) and in the browser (`lib/cache.ts`). Student-specific data is dropped on sign in, sign out and when a round finishes.

Original plan follows. Status: plan only. Design is on the canvas (Read hub, Read topic, Read desktop). Source: EXL Learn's read-only Content API (`_projects_/exl_learn/exl-learn-concept/docs/content-api.md` and `lesson-api-v1.4.md`).

## What the Read page is

A reading page, not a video page. A student picks a subject and topic, searches, and reads short notes with key points, formulas and common traps, then taps "Practise this topic". It sits beside the path: a unit sheet offers "Read this topic first", a weak result offers "Read this topic", and "Work on this" links to it.

## What EXL gives us

- `GET /api/v1/catalogue`: Subject, Topic, Subtopic, Lesson tree of published lessons only. `/subjects`, `/topics/{id}/lessons`, `/lessons` (paged) and `/lessons/{id}` are also available.
- A published lesson is structured data, never HTML: a cover, concept slides with headings, worked examples in stages, quick checks, a summary. Text is rich (marks), maths is LaTeX with chemistry (mhchem), plus lists and callouts (quick tip, common mistake, did you know).
- No keys. Content is public to anyone with the URL, so anything paid must be gated by JAMB Prep's own server.
- Responses are `no-store`, so JAMB Prep must cache.
- Today the live data looks thin: from one count I made, EXL holds 2 published lessons. The Read page has to cope with almost no content and fill in as lessons are published.

## Decisions (settled 2026-11-28)

1. **Hosting.** The owner deploys EXL Learn on Vercel first (push the unpushed lesson and reader commits) and gives JAMB Prep its HTTPS address. Until then Read cannot go live. Set as `EXL_API_BASE` on the server.
2. **Free or paid.** Everything is free at launch. `read_access` and the paywall wait until there is enough content to sell.
3. **Topic mapping.** Claude drafts the table from EXL's topic list and JAMB Prep's topics. The owner corrects it on an admin page.
4. **Do lessons read well as notes?** Yes, checked 2026-11-28 against "Dalton's Atomic Theory". Teaching steps are plain prose with bold terms, key terms, and callouts (did you know, common mistake, exam tip, equation), so they work as a reader. Illustrations are still `status: pending` with no image, so skip them for now. Quick checks and the closing knowledge check can be left out or shown as optional.

**Live EXL (https://exllearn.vercel.app, 2026-11-28):** the catalogue works, but only 2 lessons are published, both Chemistry (Structure of the Atom, Acids Bases and Salts). No Maths or English. The Read tab must stay hidden or say "Coming soon" per subject until more are published.

## Design

**Data (one migration).**
- `read_topic_map(topic_id, exl_topic_id, exl_lesson_id, sort_order)`: which EXL lesson teaches which JAMB topic. One topic can have several lessons.
- `read_access(user_id, subject_id nullable, until)`: who has paid. Empty until the paywall is switched on.
- `read_progress(user_id, lesson_id, section, updated_at)`: where each student stopped, for "Continue reading".

**Server.** Route handlers under `app/api/read/` fetch EXL, cache the catalogue for about 10 minutes and each lesson by its published version, and return only what the student may see. Locked lessons return the title and a locked flag, never the body. Nothing in the browser talks to EXL.

**Screens.**
- **Read hub:** search, subject chips, "Continue reading", topics grouped like the path themes, with Free and locked tags. A subject with no published lessons says "Coming soon", never an empty list.
- **Reader:** one section at a time with a progress bar, serif text, key-point, example and trap cards, and a sticky "Practise this topic" button that starts a round on the topic's path unit.
- **Desktop:** topic list, reader and a section outline in three columns.
- **Entry points:** unit sheet, round result and "Work on this".

**Rendering.** JAMB Prep already renders maths in `components/content/`. It needs mhchem for chemistry and renderers for lists, callouts and staged worked examples. Unsupported blocks fall back to their source text.

## Phases

| # | Phase | Size |
|---|---|---|
| 0 | Owner deploys EXL; read two real lessons as notes (decision 4) | small |
| 1 | EXL client, cache, mapping table, admin mapping page | medium |
| 2 | Hub and reader screens (phone, then desktop) | medium |
| 3 | Entry points from the path and results | small |
| 4 | Paywall and access grants | later, not at launch |
| 5 | Offline packs (EXL already serves a package per lesson) | later |

## Risks

- **Thin content.** With only a handful of lessons the Read tab could look empty. Mitigation: hide the tab until some content exists, or show only subjects with lessons.
- **Mapping drift.** If EXL topics change, the map goes stale. Mitigation: the admin page lists unmapped lessons and mapped lessons that EXL no longer serves.
- **Public content.** If paid lessons are fetched from the browser they leak. All fetching stays on the server.
