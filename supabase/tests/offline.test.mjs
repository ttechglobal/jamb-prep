// Tests for the offline apps migration (schools, devices, events, campaigns, config, packs, leaderboard).
// Runs against the real database inside one transaction that is always rolled back.
// Run: npm run db:test:offline
import postgres from "postgres";

const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false, onnotice: () => {} });

let passed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) passed++;
  else failures.push(`${name}${detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
}
class Rollback extends Error {}

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const DEV = { a: uuid(101), b: uuid(102), c: uuid(103), d: uuid(104), x: uuid(199) };
const USERS = { ada: uuid(1), guest: uuid(2), hidden: uuid(3) };

try {
  await sql.begin(async (tx) => {
    const asOwner = () => tx.unsafe("reset role");
    const as = async (role) => {
      await tx.unsafe("reset role");
      await tx`select set_config('request.jwt.claims', '{}', true)`;
      await tx.unsafe(`set local role ${role}`);
    };
    const asUser = async (id) => {
      await tx.unsafe("reset role");
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: id, role: "authenticated" })}, true)`;
      await tx.unsafe("set local role authenticated");
    };
    const rpc = async (name, args) => {
      const isJson = (a) => typeof a === "object" && a !== null;
      const list = args.map((a, i) => (isJson(a) ? `$${i + 1}::text::jsonb` : `$${i + 1}`)).join(", ");
      const values = args.map((a) => (isJson(a) ? JSON.stringify(a) : a));
      const [row] = await tx.unsafe(`select public.${name}(${list}) as r`, values);
      return row.r;
    };
    const rejects = async (name, expected, fn) => {
      try {
        await tx.savepoint(fn);
        check(name, false, "was allowed");
      } catch (e) {
        check(name, e.message.includes(expected), e.message);
      }
    };
    const register = (device, phone, number, extra = {}) =>
      rpc("register_school_device", [
        device, extra.name ?? "Government College Ikeja", phone, "Lagos", "Ikeja", extra.prefix ?? "GCI", number,
        "1.0.0", "windows", extra.offline ?? false,
      ]);

    // Schools and devices ----------------------------------------------------
    await as("anon");
    check("unknown phone is not found", (await rpc("lookup_school", ["08031234567"])).found === false);
    const first = await register(DEV.a, "0803 123 4567", 1);
    check("first device gets label GCI-001", first.label === "GCI-001", first);
    const again = await register(DEV.a, "0803 123 4567", 1);
    check("registering the same device again is safe", again.label === "GCI-001" && again.school_id === first.school_id, again);
    const found = await rpc("lookup_school", ["+234 803 123 4567"]);
    check("phone formats match the same school", found.found === true && found.name === "Government College Ikeja" && found.devices === 1 && found.prefix === "GCI", found);

    let taken;
    try {
      await tx.savepoint((s) => register(DEV.b, "2348031234567", 1));
    } catch (e) {
      taken = e;
    }
    check("a taken number is refused", taken?.message === "device_number_taken", taken?.message);
    check("the refusal carries the next free number", taken?.detail === "2", taken?.detail);

    const second = await register(DEV.b, "2348031234567", 2);
    check("another PC joins the same school", second.school_id === first.school_id && second.label === "GCI-002", second);
    const renumbered = await register(DEV.c, "08031234567", 1, { offline: true });
    check("an offline registration is renumbered, not refused", renumbered.renumbered === true && renumbered.label === "GCI-003", renumbered);
    const otherPrefix = await register(DEV.d, "08031234567", 1, { prefix: "lab" });
    check("a different prefix can reuse a number (and is upper-cased)", otherPrefix.label === "LAB-001", otherPrefix);

    await rejects("a phone with too few digits is refused", "invalid_registration", () => register(DEV.x, "0803", 1));
    await rejects("a one letter prefix is refused", "invalid_registration", () => register(DEV.x, "08099999999", 1, { prefix: "G" }));

    await rejects("schools cannot be read directly", "permission denied", () => tx`select * from public.schools`);
    await rejects("devices cannot be read directly", "permission denied", () => tx`select * from public.school_devices`);

    // Events -----------------------------------------------------------------
    const ev = (n, kind, props, extra = {}) => ({ id: uuid(1000 + n), at: new Date().toISOString(), kind, subject: "english", mode: "subject", props, ...extra });
    const batch = [
      ev(1, "session_started", { total: 20 }),
      ev(2, "session_completed", {
        total: 20, answered: 30, correct: 12, duration_sec: 600,
        per_topic: [{ topic_id: "t1", name: "Lexis and structure", answered: 30, correct: 9 }],
      }),
      ev(3, "pack_downloaded", { version: 3 }),
      ev(4, "pack_failed", { version: 3, error: "timeout" }),
      ev(5, "not_a_real_kind", {}),
      ev(6, "app_opened", {}, { at: "2999-01-01T00:00:00Z" }),
    ];
    const res = await rpc("school_sync", [DEV.a, batch, "1.0.1"]);
    check("valid events are accepted, unknown kinds dropped", res.accepted === 5, res);
    const repeat = await rpc("school_sync", [DEV.a, batch, "1.0.1"]);
    check("repeated ids are ignored", repeat.accepted === 0, repeat);
    await rejects("an unknown device is refused", "unknown_device", () => rpc("school_sync", [DEV.x, batch, null]));
    await rejects("a batch over 500 is refused", "bad_batch", () => rpc("school_sync", [DEV.a, Array.from({ length: 501 }, (_, i) => ev(5000 + i, "app_opened", {})), null]));

    await asOwner();
    const [future] = await tx`select count(*)::int as n from public.school_events where id = ${uuid(1006)} and at <= now()`;
    check("a clock in the future is clamped to now", future.n === 1, future);

    // Admin ------------------------------------------------------------------
    await as("anon");
    await rejects("anon cannot call admin_schools", "permission denied", () => rpc("admin_schools", [30]));
    await rejects("anon cannot change the admin password", "permission denied", () => rpc("admin_set_password", ["short"]));
    await rejects("anon cannot read the admin password hash", "permission denied", () => rpc("admin_password_hash", []));
    await rejects("anon cannot read the reminder audience", "permission denied", () => rpc("reminder_audience", []));
    await asUser(USERS.ada);
    await rejects("a signed-in student cannot call admin_overview", "permission denied", () => rpc("admin_overview", [14]));
    await as("anon");
    await as("service_role");
    const list = await rpc("admin_schools", [30]);
    const mine = list.schools.find((s) => s.id === first.school_id);
    check("admin sees the school with its activity", mine && mine.devices === 4 && mine.sessions_completed === 1 && mine.questions_answered === 30 && mine.active_devices === 1, mine);
    const detail = await rpc("admin_school_detail", [first.school_id, 30]);
    check("detail counts the drop-off funnel", detail.sessions.started === 1 && detail.sessions.completed === 1 && detail.sessions.abandoned === 0, detail.sessions);
    check("detail counts downloads", detail.downloads.done === 1 && detail.downloads.failed === 1, detail.downloads);
    check("detail lists the weak topic with its accuracy", detail.weak_topics[0]?.topic === "Lexis and structure" && Number(detail.weak_topics[0].accuracy) === 30, detail.weak_topics);
    check("detail does not leak the phone key", detail.school.phone_key === undefined);
    await rejects("detail of a missing school fails", "not_found", () => rpc("admin_school_detail", [uuid(555), 30]));

    // Merge: a school registered with a mistyped phone joins the real one.
    await as("anon");
    const dup = await register(uuid(201), "08039999999", 1, { name: "Govt College Ikeja" });
    await as("service_role");
    const merged = await rpc("admin_merge_schools", [first.school_id, dup.school_id]);
    check("merge moves the device", merged.moved_devices === 1, merged);
    const after = await rpc("admin_school_detail", [first.school_id, 30]);
    check("the merged device was renumbered to a free label", after.devices.some((d) => d.label === "GCI-004"), after.devices);
    await asOwner();
    const [gone] = await tx`select count(*)::int as n from public.schools where id = ${dup.school_id}`;
    check("the duplicate school is gone", gone.n === 0, gone);
    await as("service_role");
    await rejects("merging a school into itself is refused", "invalid_merge", () => rpc("admin_merge_schools", [first.school_id, first.school_id]));

    // Campaigns and config ---------------------------------------------------
    await as("service_role");
    await tx`insert into public.campaigns (title, body, audience, starts_at, ends_at) values
      ('Open school', 'for schools', 'school', now() - interval '1 day', now() + interval '1 day'),
      ('Open student', 'for students', 'student', now() - interval '1 day', now() + interval '1 day'),
      ('Open all', 'for everyone', 'all', now() - interval '1 day', now() + interval '1 day'),
      ('Ended', 'old', 'all', now() - interval '3 days', now() - interval '2 days'),
      ('Soon', 'not yet', 'all', now() + interval '2 days', now() + interval '3 days'),
      ('Off', 'switched off', 'all', now() - interval '1 day', now() + interval '1 day')`;
    await tx`update public.campaigns set active = false where title = 'Off'`;
    await as("anon");
    const school = (await rpc("get_campaigns", ["school"])).map((c) => c.title);
    const student = (await rpc("get_campaigns", ["student"])).map((c) => c.title);
    check("schools see their own and shared campaigns, nothing outside dates or switched off",
      school.includes("Open school") && school.includes("Open all") && !school.includes("Open student") && !school.includes("Ended") && !school.includes("Soon") && !school.includes("Off"), school);
    check("students see theirs and shared", student.includes("Open student") && student.includes("Open all") && !student.includes("Open school"), student);
    await rejects("campaigns cannot be read directly", "permission denied", () => tx`select * from public.campaigns`);

    check("empty config is sent as an empty object", Object.keys(await rpc("get_remote_config", [])).length === 0);
    await as("service_role");
    await tx`update public.remote_config set value = 'https://example.test/join' where key = 'signup_link'`;
    await as("anon");
    const config = await rpc("get_remote_config", []);
    check("config sends only filled values", config.signup_link === "https://example.test/join" && Object.keys(config).length === 1, config);

    // Packs ------------------------------------------------------------------
    await as("service_role");
    await tx`insert into public.content_packs (subject_id, version, question_count, size_bytes, sha256, file_path, is_current)
             values ('english', 9001, 60, 1000, ${"a".repeat(64)}, 'english/english-v9001.zip', true)`;
    await rejects("only one current pack per subject", "content_packs_one_current", () =>
      tx`insert into public.content_packs (subject_id, version, question_count, size_bytes, sha256, file_path, is_current)
         values ('english', 9002, 60, 1000, ${"b".repeat(64)}, 'x.zip', true)`);
    await as("anon");
    const manifest = await rpc("get_pack_manifest", []);
    const eng = manifest.find((p) => p.subject === "english");
    check("the manifest lists the current pack without its file path", eng?.version === 9001 && eng.sha256 === "a".repeat(64) && eng.file_path === undefined, eng);
    await rejects("packs cannot be read directly", "permission denied", () => tx`select * from public.content_packs`);

    // Leaderboard ------------------------------------------------------------
    await asOwner();
    await tx`insert into auth.users (id, aud, role, email, is_anonymous) values
      (${USERS.ada}, 'authenticated', 'authenticated', 'ada@example.test', false),
      (${USERS.guest}, 'authenticated', 'authenticated', null, true),
      (${USERS.hidden}, 'authenticated', 'authenticated', 'hidden@example.test', false)`;
    for (const [id, name] of [[USERS.ada, "Ada Okafor"], [USERS.guest, "Guest Person"], [USERS.hidden, "Hidden Student"]]) {
      await tx`insert into public.profiles (id, display_name) values (${id}, ${name}) on conflict (id) do update set display_name = excluded.display_name`;
    }
    await tx`update public.profiles set show_on_leaderboard = false where id = ${USERS.hidden}`;
    for (const id of Object.values(USERS)) {
      const [s] = await tx`insert into public.practice_sessions (user_id, mode, config, feedback, question_count)
                           values (${id}, 'quick_five', '{}'::jsonb, 'instant', 5) returning id`;
      await tx`update public.practice_sessions set status = 'submitted', submitted_at = now(), reward = '{"xpGained": 1000000}'::jsonb where id = ${s.id}`;
    }
    const [logged] = await tx`select count(*)::int as n from public.xp_log where user_id = ${USERS.ada} and xp = 1000000`;
    check("finishing a session logs its XP", logged.n === 1, logged);

    await as("anon");
    const board = await rpc("get_leaderboard", ["week"]);
    check("the board shows first name and last initial", board.rows[0]?.name === "Ada O." && board.rows[0].xp === 1000000 && board.rows[0].rank === 1, board.rows[0]);
    check("guests and hidden students are left out", !JSON.stringify(board).includes("Guest") && !JSON.stringify(board).includes("Hidden"), board.rows);
    check("a signed-out caller has no row of their own", board.me === null && board.rows.every((r) => r.me === false), board);
    check("the board holds at most 20", board.rows.length <= 20);
    for (const period of ["month", "all"]) {
      const b = await rpc("get_leaderboard", [period]);
      check(`the ${period} board works`, b.period === period && b.rows[0]?.name === "Ada O.", b.period);
    }
    check("an unknown period falls back to week", (await rpc("get_leaderboard", ["decade"])).period === "week");
    await asUser(USERS.ada);
    const mineBoard = await rpc("get_leaderboard", ["week"]);
    check("a signed-in student sees their own row marked", mineBoard.rows[0]?.me === true && mineBoard.me?.rank === 1, mineBoard.me);

    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) {
    failures.push(`crashed: ${e.message}`);
  }
}

await sql.end();
console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);
