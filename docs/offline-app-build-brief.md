# Build brief: JAMB Prep Flutter apps

For the chat that builds the Flutter app. Everything decided so far is in this repo. Read this first, then the files it points to. Do not re-open decisions listed as decided; ask the owner only about the open items at the end.

## What we are building

One Flutter codebase, three products:

| Product | Platform | Who | Account |
|---|---|---|---|
| School | Windows 10+ | schools (free) | none, registers the device |
| Student desktop | Windows 10+ | students | Supabase sign-in |
| Student mobile | Android | students | Supabase sign-in |

- **Mobile is students only.** It opens like the web app (landing, sign in, onboarding). No School/Student choice.
- **The Windows app asks "I am a school / I am a student" on first launch.** School mode exists only there.
- Everything works offline once question packs are downloaded. First install needs internet (registration and first pack). Offline registration is allowed and finishes later.
- The owner owns the software and installer quality, not the schools' PCs. Do not design around old Windows, restore software or lab setup.

## Read first (in this order)

1. `docs/offline-app-plan.md`: decisions by round. Later rounds override earlier ones.
2. `docs/offline-app-design.html`: the visual spec for all three products. Open it in a browser. Source is `docs/offline-app-design.src.html`; rebuild with `node scripts/build-offline-design.mjs`. Follow it exactly: tokens, fonts, cards, buttons, spacing, navigation.
3. `docs/offline-app-contracts.md`: server API, event format, pack format, on-device database, rules that must match the web app.
4. `supabase/migrations/20261110000001_offline_apps.sql` and `20261110000002_lock_admin_functions.sql`: the server side, **already applied** to the live database.
5. The web app, for behaviour to copy: `app/(main)/practice/page.tsx` (home), `components/practice/*` (setup screens), `components/session/*` (question, feedback), `app/(app)/session/[id]/results/page.tsx`, `lib/engine/presets.ts`, `lib/exam-format.ts`, `lib/game/rules.ts`, `lib/games/concord/*`, `lib/content/types.ts` and `components/content/blocks.tsx` (question blocks), `app/globals.css` (tokens), `components/brand/logo.tsx`.

## Design rules (do not drift)

- Use the web app's tokens exactly (brand green `#15803D`, page `#F5F9F6`, game cards with a thick bottom edge, chunky buttons with a bottom shadow). Fonts: Fredoka for headings and buttons, Plus Jakarta Sans for body, Literata for reading passages. Font files are in `app/fonts`.
- Logo: the labelled mark (cap with the gold JAMB band) plus "JAMB Prep", always at the top. See `components/brand/logo.tsx` for the exact shapes.
- Desktop navigation: deep green sidebar, logo at top, active item a white pill. Mobile: bottom bar (Practice, Games, Leaderboard, Downloads, Profile). **No navigation in a practice session or on setup screens.** It returns on results.
- Background: very faint subject-icon pattern (`docs/assets/learning-pattern.svg`), under solid white cards.
- Downloads: round icon buttons, never the word, no file sizes. A Downloads page exists in all three products.
- Mascot is optional. Build slots that disappear without the image (`docs/assets/mascot.png`). Do not depend on it.
- Games page is the web page unchanged (one Concord card). Do not redesign games.

## Architecture (recommended, change only with a reason)

- Flutter stable, Dart 3. `supabase_flutter` for auth and RPC. SQLite through `drift` (or `sqflite_common_ffi` on Windows with the same schema). `flutter_riverpod` for state. `go_router` for navigation. `dio` for resumable pack downloads. `archive` for unzipping. `crypto` for SHA-256. `qr_flutter` for the QR code. `flutter_math_fork` (or equivalent) for maths blocks. `file_picker` for the school logo.
- Feature folders: `core` (tokens, theme, widgets such as GameCard, ChunkyButton, ChoiceChip), `data` (local db, pack store, supabase client, sync queue), `engine` (session picking and scoring), `features` (onboarding, home, practice, session, results, games, leaderboard, downloads, history, settings), `app` (shell, router, mode).
- Mode (`school` or `student`) is stored on the device and chosen only on Windows. Gate features by mode in one place.
- A repo of its own is recommended (for example `jambprep_app`), with `docs/` copied or linked. The web repo stays untouched.

## Hard rules

1. **Contracts are fixed.** Use the function names, arguments, error codes and event kinds in `offline-app-contracts.md`. If something must change, change the contract and the migration together and ask the owner.
2. **Packs are never public and never trusted blindly.** Verify SHA-256 before use, unzip into a new folder, switch the pointer, then delete the old version. A failed download must never replace a working pack. If `schemaVersion` is newer than the app knows, keep the old pack and say "update the app".
3. **Scoring and XP must match the web.** Rules are in the contracts (section 5). Create one shared file of test cases (inputs and expected outputs) that the Dart engine passes; the existing SQL is the reference. Mock: English 60 questions (up to 10 from the prescribed literature text, otherwise all 60 English), others 40; time 2/3 minute per question; the student may lower it, never raise it.
4. **No personal data in school mode.** Events carry only device, school, subject, mode and counts. The school logo stays on the device.
5. **Never use the secret key in the app.** Apps use only the public key and the granted functions. New server functions are private until explicitly granted (the database now defaults to that). Admin functions are service role only.
6. **Do not change the live database without asking the owner.** Migrations are applied with `npm run db:push` in the web repo; tests are `npm run db:test` and `npm run db:test:offline`. Both test commands roll back. The Supabase connector in this tooling cannot see the app's project, so use those commands.
7. **Offline first.** Every screen must work with no connection once packs are installed. Network calls are background work with a visible, non-blocking state.

## Phases

### Phase 0: project skeleton (small)
Flutter project for Windows and Android, theme from the tokens, fonts, core widgets (GameCard, ChunkyButton, ChoiceChip, Meter, StarRow, sidebar, bottom bar), logo widget, background pattern, router, mode store. A gallery screen showing every widget next to the design file.
Done when: the gallery matches `offline-app-design.html` side by side on Windows.

### Phase 1: School desktop (the priority)
In this order:
1. Local database and device id; Welcome (School or Student); Register school (online lookup by phone, device name, offline path with the pending reminder); sync queue.
2. Downloads: manifest, resumable download via the `pack-url` edge function, verify, install, update, delete; first-download screen.
3. Engine: question picking from the installed pack, sessions, scoring, results.
4. Home (Quick Five hero with six subjects and "More subjects"; Subject, Timed, Mock cards; Games and Leaderboard cards; last session; campaign banner at the bottom), Practice page (mode row, all subjects), subject setup (questions, Practice or Study mode, timer, topics), Timed setup, Mock (choose up to 4, instructions, time stepper), question and feedback screens, results.
5. Question renderer for every block type (paragraph, math, verse, dialogue, table, figure), passages with Literata, figure enlarge.
6. Games: Concord (same rules and levels as the web; move level data to JSON shared by both).
7. Leaderboard (read-only with the sign-up teaser, tabs week, month, all time, cached), "how to sign up" sheet (link from `get_remote_config`, QR code), campaigns banner and details sheet (from `get_campaigns('school')`, cached), History, Settings.
8. Event upload, update check (`get_remote_config`), Windows installer (Inno Setup `.exe`).
Done when: a fresh Windows PC with internet can register a school, download two subjects, then work fully offline with the network off, and the events arrive on the server when it is back online.

### Phase 2: Student mode on desktop
Sign in with Supabase, cached for offline. Home with progress card (level, target), Quick Five over the student's four subjects, profile, XP, streak, level, sync of progress. Free limits (Quick Five unlimited, Subject and Timed 2 per week, monthly mock paid, first 5 game levels free) need the entitlements design below, so build the screens and the local counters first and gate behind a stub.

### Phase 3: Android student app
Same code, mobile layouts: bottom bar, mobile Home order (progress card, Quick Five, modes, campaign banner at the bottom), no navigation in sessions and setup. Push reminders reuse the existing web system or are out of scope for now (ask).

## Server work still to do (separate from the Flutter app)

Do these as their own tasks; the app depends on the first two.
1. **Edge function `pack-url`:** takes `{subject, version}` plus the device id (school) or the student's session, verifies them, returns a short-lived signed URL for the private `packs` bucket.
2. **Pack build script:** reads published questions, solutions, contexts, works and media with the service key, writes `pack.sqlite` and `media/`, zips, hashes, uploads, inserts `content_packs`, flips `is_current`. Format is in the contracts, section 2.
3. **Admin pages** in the web app (`/admin`): Schools (list, detail, merge), Campaigns, Settings (sign-up link, versions, installer link), Packs. The functions and tables exist.
4. **Leaderboard on the web app** (student side). The function `get_leaderboard` exists; the page and the display-name opt-out toggle do not.
5. **Entitlements and payments** for student mode (design not started).

## Open items (ask the owner)

- Sign-up link (the "how to sign up" sheet reads it from remote config; not decided).
- Mascot image and logo variants (mascot optional).
- Code-signing certificate for the Windows installer (avoids SmartScreen warnings; costs money).
- What "Lessons" contains (not designed).
- Payment provider and how free limits are enforced offline (signed token with expiry plus device counters is the plan).
- Whether Android gets push reminders in the first release.
- The existing engine test suite (`npm run db:test`) was started after the security fix but its result was not seen. Run it first and report the result.

## First message to paste into the new chat

> I am building the JAMB Prep Flutter apps (school desktop first). Read `docs/offline-app-build-brief.md`, then the files it lists, in order. Do Phase 0, then Phase 1 step by step. Follow `docs/offline-app-design.html` exactly. Do not change the database or the contracts without asking me. Start by running `npm run db:test` and `npm run db:test:offline` in the web repo and telling me the results, then show me your plan for Phase 0 before writing code.
