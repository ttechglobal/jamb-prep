# Read page: build plan

Status: plan only. Design is on the canvas (Read hub, Read topic, Read desktop). Source: EXL Learn's read-only Content API (`_projects_/exl_learn/exl-learn-concept/docs/content-api.md` and `lesson-api-v1.4.md`).

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
4. **Do lessons read well as notes?** Still open. Read two real lessons as a page before converting them. This is the first thing to do when EXL is online.

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
