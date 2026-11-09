# Offline apps: data contracts

Status 2026-11-10. Written before any Flutter code. The server side is in `supabase/migrations/20261110000001_offline_apps.sql` (not yet applied). The visual spec is `docs/offline-app-design.html`; decisions are in `docs/offline-app-plan.md`.

Three products share one Flutter codebase and one backend:

| Product | Platform | Account | Data on device |
|---|---|---|---|
| School | Windows only | none, registers the device | packs, sessions, history, game progress, event queue |
| Student | Windows and Android | Supabase sign-in | same, plus synced progress |

## 1. Server API (Supabase RPC)

All are called with the project's public key. No table is readable directly.

### Schools and devices (School mode)

| Function | Arguments | Returns | Errors |
|---|---|---|---|
| `lookup_school(p_phone)` | phone as typed | `{found:false}` or `{found:true, name, state, area, devices, prefix}` | none |
| `register_school_device(...)` | `p_device_id uuid, p_name, p_phone, p_state, p_area, p_prefix, p_number int, p_app_version, p_os, p_offline bool` | `{school_id, school_name, state, area, prefix, number, label, renumbered}` | `invalid_registration`, `invalid_device`, `device_number_taken` (next free number in `detail`), `no_free_number` |
| `school_sync(p_device_id, p_events, p_app_version)` | event array, max 500 | `{accepted:n}` | `unknown_device`, `bad_batch` |

Rules:
- **A school is identified by its phone number**, compared on the last 10 digits (`+234 803 123 4567`, `0803 123 4567` and `2348031234567` match). Prefix and number are only a device label (`GCI-001`) and are unique per school, not across schools.
- The device id is a UUID made on the device on first launch. It is the device's secret. Registering again with the same id is safe and returns the same label.
- Online registration: call `lookup_school` as the phone is typed; if found, fill name, state, area and suggest the next number. If `register_school_device` fails with `device_number_taken`, offer the number in `detail`.
- Offline registration: the app stores the form, lets the user continue, shows the "not registered yet" reminder, and calls `register_school_device` with `p_offline = true` as soon as it is online. The server renumbers instead of rejecting, and the app must replace its stored label with the returned one.

### Events

Queue events locally and upload with `school_sync` when online (on launch, after each session, every 15 minutes while open). Delete a queued event only after a successful call. Every event has a UUID made on the device, so retries cannot duplicate.

| kind | `subject` | `mode` | `props` |
|---|---|---|---|
| `app_opened` | | | `{}` |
| `session_started` | subject id | `quick_five`, `subject`, `timed`, `mock` | `{total}` |
| `session_completed` | subject id (mock: first subject) | same | `{total, answered, correct, duration_sec, per_topic:[{topic_id, name, answered, correct}]}` |
| `session_abandoned` | subject id | same | `{total, answered}` |
| `pack_downloaded` | subject id | | `{version}` |
| `pack_failed` | subject id | | `{version, error}` |
| `game_completed` | | | `{game, level, stars}` |

No names and no personal data. Props up to 4000 characters; the server drops the rest.

### Campaigns and settings

| Function | Returns |
|---|---|
| `get_campaigns(p_audience)` | `p_audience` is `school` or `student`. Active campaigns inside their dates: `[{id, title, body, link_url, starts_at, ends_at}]` |
| `get_remote_config()` | `{signup_link?, latest_windows_version?, min_windows_version?, installer_url?}` (empty values omitted) |

Load both on launch when online, cache them, and show the cached copy offline. The device clock decides whether a cached campaign is inside its dates. Home shows the banner only if the list is non-empty. The "how to sign up" sheet shows `signup_link` as text and as a QR code; hide the link row if it is missing.

### Packs

| Function | Returns |
|---|---|
| `get_pack_manifest()` | `[{subject, version, schemaVersion, questions, bytes, sha256}]` for current packs |

Downloading the file needs a short-lived link from an edge function, `pack-url` (**not built yet**): it takes `{subject, version}` plus the device id (school) or the student's session, checks they are registered or signed in, and returns a signed URL for the private `packs` bucket. Packs contain answers, so the bucket is never public.

### Leaderboard

`get_leaderboard(p_period)` with `'week'` (Monday to Sunday, Lagos time), `'month'` or `'all'` returns `{period, since, rows:[{rank, name, xp, me}], me:{rank, xp}|null}`. Top 20. Names are first name and last initial. Guests and students who turned off `profiles.show_on_leaderboard` are excluded. Callable without signing in, so School mode can show it. XP by date comes from the new `xp_log` table, filled by a trigger when a session finishes. Cache the response on the device and show it offline with a "last updated" note.

### Admin (service role, used by the `/admin` pages)

`admin_schools(p_days)`, `admin_school_detail(p_school, p_days)`, `admin_merge_schools(p_keep, p_merge)`. Direct table access for `campaigns`, `remote_config`, `content_packs`. Admin pages to build: Schools (list and detail with merge), Campaigns, Settings (sign-up link, versions, installer link), Packs.

## 2. Pack file

One file per subject: `<subject>-v<version>.zip`, stored at `packs/<subject>/<subject>-v<version>.zip`.

```
manifest.json     {subject, version, schemaVersion, questionCount, builtAt}
pack.sqlite       the database below
media/<hash>.<ext>   figures and diagrams, referenced from blocks as "media/<hash>.<ext>"
```

The app verifies the zip's SHA-256 against the manifest before using it, unzips into `packs/<subject>/v<version>/`, then switches the "current" pointer and deletes the old version. A failed or partial download never replaces a working pack. Downloads resume.

`schemaVersion` is 1. If a pack's `schemaVersion` is higher than the app understands, the app says "update the app" and keeps the old pack.

### `pack.sqlite`

Content columns use the same block JSON as the web app (`lib/content/types.ts`: paragraph, math, verse, dialogue, table, figure).

```sql
create table meta (key text primary key, value text not null);          -- subject, version, built_at
create table topics (id text primary key, name text not null, sort_order int not null);
create table subtopics (id text primary key, topic_id text not null references topics(id), name text not null, sort_order int not null);
create table contexts (id text primary key, kind text not null, title text, blocks text not null, credit text);   -- shared passages, poems, tables
create table works (id text primary key, title text not null, author text not null);
create table questions (
  id text primary key,
  topic_id text references topics(id),
  subtopic_id text references subtopics(id),
  context_id text references contexts(id),
  work_id text references works(id),
  work_reference text,
  instruction text,                 -- blocks JSON or null
  stem text not null,               -- blocks JSON
  options text not null,            -- JSON [{key:'A', blocks:[...]}, ... 4 items]
  year int,
  source text not null,             -- past_paper | practice
  correct_option text not null,     -- A..D
  hint text,
  solution text                     -- blocks JSON or null
);
create index questions_topic_idx on questions(topic_id);
create index questions_context_idx on questions(context_id);
```

Rules:
- Only `published` questions go in. A question with a shared context carries its context row.
- English: questions from the prescribed literature text are those with a `work_id`. A mock draws 10 of them; if the pack has none, all 60 come from English questions.
- The build script (to write) reads the database with the service key, writes the zip, computes the hash, uploads to the `packs` bucket, inserts a `content_packs` row, and flips `is_current` for the subject.

## 3. Device database (`app.sqlite`, both products)

```sql
create table device (id text primary key, mode text not null,              -- 'school' | 'student'
  registration text not null,                                               -- 'pending' | 'done' (school only)
  school_name text, school_phone text, school_state text, school_area text,
  prefix text, number int, school_id text, created_at text not null);
create table installed_packs (subject text primary key, version int not null, schema_version int not null, path text not null, installed_at text not null);
create table sessions (
  id text primary key, mode text not null, config text not null,           -- config JSON
  feedback text not null,                                                   -- 'instant' | 'end'
  started_at text not null, deadline_at text, submitted_at text, status text not null,  -- in_progress | submitted | expired
  total int not null, answered int, correct int, accuracy int, duration_sec int, utme_score int, per_subject text, reward text);
create table session_questions (session_id text not null references sessions(id), position int not null, subject text not null, question_id text not null, primary key (session_id, position));
create table answers (session_id text not null, question_id text not null, selected text, answered_at text not null, primary key (session_id, question_id));
create table game_progress (game text primary key, data text not null, updated_at text not null);
create table event_queue (id text primary key, at text not null, kind text not null, subject text, mode text, props text not null, tries int not null default 0);
create table cache (key text primary key, value text not null, fetched_at text not null);   -- campaigns, remote_config, leaderboard:<period>
create table settings (key text primary key, value text not null);                          -- school logo path, free-limit counters
```

- The device generates `device.id` (UUID v4) on first launch.
- The school logo is copied into the app's data folder and never uploaded.
- Session start picks questions from the installed pack; scoring runs on the device with the same rules as `finalise_session` (see 5).

## 4. Student mode on the device

- Sign in with the existing Supabase auth. A signed-in session is cached so the app opens offline.
- Progress (XP, streak, level) is computed on the device and synced when online: upload finished sessions, pull the server's totals, and take the larger XP and streak if they disagree. Server XP stays the source of truth for the leaderboard (`xp_log`).
- **Entitlements are not designed yet.** The plan is a signed token from the server with an expiry that says which features are open, plus a weekly counter on the device. Payments are undecided, so no tables are created for it now.

## 5. Rules that must match the web app

Keep these in one shared test file (inputs and expected outputs) that both the SQL and the Dart code pass.

- Scoring: each subject out of 100 (`round(correct * 100 / total)`), mock total is the sum. Unanswered is wrong.
- XP: `correct * 2 + 2`, plus 2 when 3 stars (90% or more), none when nothing was answered. Stars: 90+ is 3, 70+ is 2, 40+ is 1.
- Streak and level: as in `finalise_session` and `level_for`.
- Mock: English 60 questions, others 40. Time is 2/3 of a minute per question (180 questions = 120 minutes), may be lowered, never raised.
- Practice timer default: 2/3 of a minute per question.

## 6. Not built yet

- Edge function `pack-url` (signed download link) and the pack build script.
- Admin pages (Schools, Campaigns, Settings, Packs) and the Admin tables' screens.
- Student entitlements and payments.
- The Flutter app itself.
