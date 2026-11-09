# Offline app (Flutter): plan

Status: planning, 2026-11-09. Nothing built. Design is finished in this chat, then handed to a build chat.

## Why

Schools want to install the app for free. Many have poor or no internet, so the app must work offline.
The school edition is the priority. The student edition plugs into the same app later.

## Decisions made

- **One Flutter app**, Windows first, Android later. On first launch the user picks **School** or **Student**.
- **Windows 10 or newer only.** Old Windows, restore software (Deep Freeze) and lab setup are the school's problem. Our job is software and installer quality.
- **First install needs internet.** No bundled "full offline installer" for now. After packs are downloaded, the app works offline.
- **Question packs, one per subject**, downloaded one at a time, in the background, resumable.
- **School mode is always free.** No account. All subjects unlocked. History is per device, not per student.
- **School registration is self-service and can be done offline** (see "Round 2 decisions"). The school code is only a device-name prefix, not a unique key.
- **Student mode is paid in part** (see Entitlements). Not built first, but the app must be shaped for it.

## Modes and screens

### School mode (build first)

| Screen | What it does |
|---|---|
| Welcome / mode choice | School or Student. Remembered after first choice. |
| Register school | Phone, school name, state (list of Nigerian states), area, device name. See "Round 2 decisions". |
| First download | Pick a subject, download its pack with progress. Others download later. |
| Home | Generic welcome (school name shown). Practice modes, subjects, Games, History. No targets, no XP, no streaks. |
| Practice | Quick Five (picks subject), Subject practice, Topic practice, Mock (student picks any four subjects, all packs needed). Same session screens as the web app. |
| Session and results | Same as the web app: verdict, one line, toggle. No XP card. |
| Games | Concord and later games. All levels open. |
| History | Per device. Sessions with date, subject, score. |
| Subject packs | Per subject: not downloaded, downloading, ready, update available, size, delete. |
| Settings | School name and code, device ID, packs, storage used, sync status, app version, check for update. |

### Student mode (later, same app)

Adds sign-in, preferred four subjects, targets, XP, mock review per subject, push-free reminders. Needs the entitlement rules below.

## Entitlements (student mode)

| Feature | Free | Paid |
|---|---|---|
| Quick Five | Unlimited | |
| Subject practice and Topic practice | 2 per week | Unlimited |
| Monthly mock | | Paid |
| Games | First 5 levels | Rest unlocked |
| Lessons | To be designed | |

Offline enforcement: the server issues a signed entitlement token with an expiry. The app trusts the token and keeps the weekly counter locally. Clock tampering is possible. Accept some leakage and don't build anti-cheat.

## Question packs

- Built by a publish script from published rows in `questions`, `question_solutions`, `shared_contexts`, `prescribed_works` and media in the `question-media` bucket. Content is the structured block format (`lib/content/types.ts`): paragraph, math, verse, dialogue, table, figure.
- Format: one SQLite file per subject plus a `media/` folder, zipped, with a `manifest.json` (`subject`, `version`, `questionCount`, `size`, `sha256`). The app downloads the manifest first, compares versions, then downloads the zip.
- Hosted on Supabase Storage (public bucket `packs`). Downloads are resumable and run in the background.
- **Security note:** the web app deliberately never sends answers with questions. Packs must contain answers, because scoring happens on the device. This is fine for school mode (free). For paid student content it means the answer sits on disk. Light obfuscation is possible later. Do not rely on it.
- **Rendering:** the Flutter app needs a renderer for every block type, including maths. This is the largest single piece of UI work.

## On-device session engine

The web app does selection and scoring in Postgres (`finalise_session`, `public_question`, `reveal`). Offline, this logic moves into Dart. School mode needs: pick questions by mode, record answers, compute score. Student mode adds XP, stars, streaks and level. Keep a file of test cases (inputs and expected outputs) that both the SQL and the Dart code must pass, so they never drift.

## Registration and tracking

Tables (Supabase), written through RPC or edge function with rate limiting:

- `schools`: id, name, state, area, code (unique), created_at
- `school_devices`: id (generated on device), school_id, label, os, app_version, first_seen, last_seen
- `device_events`: device_id, type (`session_done`, `pack_downloaded`, `game_level_done`), subject, counts, at

Events queue locally and upload in batches when online. No personal data in school mode: only school, device, subject and counts. The admin app gets a Schools page later (not now).

## Distribution

- Windows installer `.exe` (Inno Setup), hosted on the website. The app checks for a newer version when online and prompts.
- Code-signing certificate costs money and avoids SmartScreen warnings. Decide before the first real school install.
- Android later, via Play Store or APK.

## Phases

1. **School desktop (Windows):** register, packs, practice, mock, games (Concord), history, settings, event upload, installer.
2. **Student mode on desktop:** sign-in, entitlements, targets, XP, reminders.
3. **Android.**

## Round 2 decisions (2026-11-09)

### Practice flow
- Practice page lists the types: Quick Five, Subject practice, Topic practice, Mock. Subject comes after.
- Setup screen (subject and topic practice): subject, number of questions, mode, timer, order.
  - **Practice mode:** answers shown at the end. **Study mode:** each answer shown right away.
  - Timer off or on. Default minutes = questions x 2/3 (same rate as the real mock).
  - Order: random, or newest first.
- Check how the web app's session feedback works (see session-feedback-design memory) so Study and Practice modes match it.

### Mock
- 1 to 4 subjects, any subjects. English is 60 questions, every other subject 40.
- Time is calculated at 2/3 minute per question (4 subjects, 180 questions = 120 min). The student may lower it, never raise it.
- Score is out of 100 per subject, summed, like the web mock.

### Registration
- Fields: school phone, school name, state (dropdown of 36 states and FCT), area (typed), device name.
- Device name is a prefix plus a number, for example `GCI-001`. Prefix is auto-filled from the school name and editable. Not unique, no availability check.
- **The school is identified by phone number.** Online: typing the phone finds an existing school and fills the other fields, so the PC joins it. No join code. Offline: fill everything in, and the server matches by phone on first sync. Admin gets a merge tool for duplicates (mistyped numbers).
- **Offline is allowed.** "Continue without internet" works. A reminder chip in the sidebar and a banner on Home stay until registration syncs. Registration never blocks practice.
- School logo: optional, stored on the device only. It is never uploaded.

### Usage data (what the owner sees)
Per school, not per device. Devices upload batched events. The server rolls them into one daily row per school.
- Are students using it: active devices, sessions per week.
- How often: active days per school.
- What they use: sessions and questions by subject, by mode, games.
- Drop-offs: sessions started but not finished, pack downloads that never finished, which step people quit at.
- Where to improve: accuracy by subject and topic.
- Admin: Schools list (last active, sessions in 7 days, devices) and a school detail page. Built on the existing `/admin`.

### Growth hooks
- **Leaderboard tab in school mode:** shows top students (cached when offline). School devices are never on it. The page tells students to create a free account on their phone to join it. Also a soft prompt on the results screen, capped in frequency.
- **Campaigns:** the app loads a campaign list when online and caches it. Each has title, text, link, start and end date, and shows on Home only inside its window. Version 1 is announcements only. Tournaments (for example a December contest) come later. A tournament fits school mode best as school-against-school using the daily rollup, since there are no student accounts.

### Mascot
One character for school and student modes. Briefs are in the chat. Needed poses: wave, cheer, think, encourage (wrong answer), sleep (offline or empty), reading, waiting (downloading), celebrate (level up). Logo is still pending.

## Round 3 decisions (2026-11-09, supersedes round 2 where they differ)

- **Practice page (school mode):** one small row of modes (Quick Five, Topic practice, Mock), no descriptions. Below it, a grid of all subjects ("Or choose a subject"), since school mode has 10 or more. Mode setup is the existing web app flow, unchanged.
- **Subject route (custom practice):** subject, then questions (5, 10, 20, 30, 40, custom), mode (Practice or Study), timer (off, 5, 10, 15, 20, 25, custom), topics (all topics or chosen topics). No order option.
- **Mock (school mode):** choose up to 4 subjects from the full list, then an instructions page listing each subject, question counts, total time (lowerable) and rules, then Start. English is 60 questions: up to 10 from the prescribed literature text. If there are no literature questions, all 60 come from English.
- **Register:** school name first, then phone. Device name is two fields, prefix and number. Online, the phone finds the school and the server suggests the next free device number. Typing a number already used by that school is flagged ("GCI-002 is already registered. Use 003?"). The same check runs when an offline registration syncs later.
- **Mascot:** a student character, fun learning atmosphere. Owner draws it. Placeholder slots in Welcome, Home and Results. Add the art when ready.

## Round 4 decisions (2026-11-09, supersedes earlier rounds where they differ)

- **UI design file:** [offline-app-design.html](offline-app-design.html) holds every screen in the web app's real design language (tokens from `app/globals.css`, game cards, chunky buttons, Fredoka and Plus Jakarta Sans), desktop and mobile. The build chat must treat it as the visual spec. Flutter must reuse the same tokens.
- **Navigation:** same pattern as the web: top header with logo, text nav (Practice, Games, Leaderboard, History, Settings), and a right cluster. In school mode the XP and streak pills are replaced by a school and device chip. Mobile shows logo and avatar only. The earlier sidebar wireframes are replaced.
- **Home is the practice hub** (the web practice page): Quick Five hero (six subjects plus "More subjects"), then Subject Practice, Timed Practice and Mock Exam cards, then Games. Students can start practising straight from Home.
- **Practice tab** is the subject-first route: all subjects listed with download status, then the custom setup. It replaces the separate Subjects page. Pack management also lives in Settings.
- **Campaign banner goes at the bottom of Home**, not the top. Registration reminder stays at the very top.
- **Leaderboard, once and for all:** student mode gets a real board (this week and all time, top 20, own row pinned, first name and last initial, ranked by XP, resets Monday). School mode shows the same board read-only, with the "Want your name here?" card and a "Show how to sign up" sheet (3 steps and a QR code). School devices never appear. Needs a backend: weekly XP per student and a public display name. Also needs building on the web app.
- **Mascot is optional.** Layouts work without it. Only the Welcome frame has a slot.
- Web practice modes stay as they are: Quick Five, Subject Practice (explanation after each answer), Timed Practice (answers at the end), Mock Exam. The subject-first setup (Practice or Study mode, timer, topics) is the school's custom route.

## Round 5 decisions (2026-11-09, supersedes earlier rounds where they differ)

- **Platforms:** mobile (Android) is for students only. It opens like the web app (landing, sign in, onboarding) with no School/Student choice. **School mode exists only in the Windows app**, which asks School or Student on first launch. Three products: student mobile, student desktop, school desktop.
- **Design file:** edit `docs/offline-app-design.src.html`, then run `node scripts/build-offline-design.mjs` to produce `docs/offline-app-design.html` (fonts and background pattern embedded) and `docs/assets/learning-pattern.svg`. It covers all three products. The build chat must treat it as the visual spec.
- **Logo:** use the real labelled logo (cap with the gold JAMB band) from `components/brand/logo.tsx`, always at the top. The mascot, when it exists, sits beside the welcome text, never before the logo. Build without it.
- **Navigation:** mobile gets a bottom bar (Practice, Games, Leaderboard, Profile). Desktop: sidebar (deep green, logo at top, active item as a white pill) or the web's top header. The design file has a switch to compare. Owner has not picked yet. **No navigation in a practice session or on setup screens.** It returns on results.
- **Download icon** replaces the word everywhere: icon with size for not downloaded, check for ready, refresh icon for update, progress bar while downloading.
- **Campaign banner:** bottom of Home, "Tap for details", opens a details sheet. Only exists while the admin page has an active campaign for that audience (school, student or both) inside its dates. Admin needs a Campaigns section.
- **Sign-up link:** not decided. The "how to sign up" sheet reads the link from a setting loaded from the admin page, so it can change without a new build. The text says "Search JAMB Prep or visit [link]" plus a QR code of the same link.
- **Fonts:** exactly the web app's (Fredoka and Plus Jakarta Sans, from `app/fonts`).
- **Background:** a faint pattern of subject icons behind pages, under solid white cards.

## Round 6 decisions (2026-11-09)

- **Downloads page** is a navigation item in all three products (school desktop, student desktop, student mobile). Per subject: small check when ready, round download button, round refresh button for updates, progress bar while downloading, trash button to remove. "Update all" and "Get all" at the top. No file sizes anywhere, no "Ready" pill. Student mobile bottom bar is now Practice, Games, Leaderboard, Downloads, Profile. Subject downloads moved out of Settings.
- **Practice page (school)** restored to the agreed layout: one compact row of modes (Quick Five, Subject, Timed, Mock Exam), then every subject below. Home stays the web-style hub.
- **Games** are the web page unchanged: one Concord card ("English: is or are? has or have? Drag the right word in."). No level numbers on the page; the levels list belongs to the Concord screen, which is not redrawn.
- **Leaderboard tabs:** This week, This month, All time (student and school).
- **Sign-up sheet wording:** "Search for JAMB Prep on Google, visit [link], or scan the code."
- **Mobile header** shows the wordmark beside the logo (it was missing).
- **Background** made much sparser: 7 icons per 560px tile at about 7% strength.
- **Mascot:** drop the file at `docs/assets/mascot.png` and rebuild (`node scripts/build-offline-design.mjs`). It appears beside the welcome text on Welcome and Home, and above the stars on Results. If the file is absent those slots disappear.

## Round 7 decisions (2026-11-10)

- **Desktop navigation: the sidebar** (deep green, logo at top, active item as a white pill). The top header option is removed from the design file.
- **Data contracts** are in [offline-app-contracts.md](offline-app-contracts.md). **Server SQL** is in `supabase/migrations/20261110000001_offline_apps.sql`: schools, devices, events, campaigns, remote config, content packs, leaderboard (xp_log), admin functions. Not applied to the database yet.
- School identity is the phone number (last 10 digits). Device label is prefix + number, unique per school only. Offline registrations are renumbered by the server rather than rejected.
- Leaderboard XP by date needs a new `xp_log` table, filled by a trigger when a session finishes.

## Open items

- What is in "lessons"? Not designed.
- Mock in school mode: confirm any four subjects, with timer.
- Repo layout: separate repo for the Flutter app, with these contracts copied or linked. Recommended, since it avoids tangling with the Next.js build.
- App name and logo for the school edition (logo still pending).
- Games ported from TypeScript: move level data into JSON so web and Flutter share it.
