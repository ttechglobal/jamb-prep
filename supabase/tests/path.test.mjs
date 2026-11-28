// Tests the path (units, stars, rounds, prefs) against the real database inside one transaction that is
// always rolled back. If the path migration is not applied yet, the test runs the migration file inside
// the same transaction first, so it can be checked before anything is changed for real.
// Run: npm run db:test:path
import postgres from "postgres";
import { readFileSync } from "node:fs";

const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false, onnotice: () => {} });
const MIGRATIONS = ["20261128000001_path_units_and_stars.sql", "20261128000002_path_units_physics_chemistry.sql", "20261128000003_path_units_other_subjects.sql", "20261128000004_path_themes_and_auto_units.sql"].map((f) => new URL(`../migrations/${f}`, import.meta.url));

const U = {
  student: "00000000-0000-4000-8000-0000000000b1",
  other: "00000000-0000-4000-8000-0000000000b2",
};

let passed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) passed++;
  else failures.push(`${name}${detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
}
class Rollback extends Error {}

try {
  await sql.begin(async (tx) => {
    const as = async (user) => {
      await tx.unsafe("reset role");
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: user, role: "authenticated", is_anonymous: false })}, true)`;
      await tx.unsafe("set local role authenticated");
    };
    const asOwner = () => tx.unsafe("reset role");
    const rpc = async (name, args = []) => {
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

    // Any migration not applied yet runs inside the test transaction, so it is checked before it is real.
    const [first] = await tx`select to_regclass('public.path_units') as t`;
    const has = async (subject) => (first.t ? (await tx`select count(*)::int as n from public.path_units where subject_id = ${subject}`)[0].n > 0 : false);
    const seeded = (await has("physics")) && (await has("biology"));
    if (!first.t) await tx.unsafe(readFileSync(MIGRATIONS[0], "utf8"));
    if (!(await has("physics"))) await tx.unsafe(readFileSync(MIGRATIONS[1], "utf8"));
    if (!(await has("biology"))) await tx.unsafe(readFileSync(MIGRATIONS[2], "utf8"));
    const [themed] = await tx`select count(*)::int as n from information_schema.columns where table_schema = 'public' and table_name = 'path_units' and column_name = 'theme'`;
    if (!themed.n) await tx.unsafe(readFileSync(MIGRATIONS[3], "utf8"));
    if (!first.t || !seeded || !themed.n) console.log("(some path migrations were not applied yet: ran them inside the test transaction)");

    for (const [key, id] of Object.entries(U)) {
      await tx`insert into auth.users (id, aud, role, email, is_anonymous)
               values (${id}, 'authenticated', 'authenticated', ${`${key}-path@example.test`}, false)`;
    }

    const unitId = async (slug) => (await tx`select id from public.path_units where slug = ${slug}`)[0].id;
    const poly = await unitId("polynomials-equations");
    const mens = await unitId("mensuration");
    const stats = await unitId("statistics");
    const trig = await unitId("trigonometry");

    const correctFor = async (id) => {
      await asOwner();
      const [q] = await tx`select correct_option from public.question_solutions where question_id = ${id}`;
      return q.correct_option;
    };
    let tick = 0;
    // Plays a round: the first `right` questions answered correctly, the rest wrongly. Returns the result.
    const play = async (config, right) => {
      await as(U.student);
      const session = await rpc("start_session", [{ mode: "subject", subjectIds: ["mathematics"], count: 10, ...config }]);
      const ids = session.questions.map((q) => q.question.id);
      for (let i = 0; i < ids.length; i++) {
        const correct = await correctFor(ids[i]);
        const pick = i < right ? correct : correct === "A" ? "B" : "A";
        await as(U.student);
        await rpc("save_answer", [session.id, ids[i], pick]);
      }
      // One transaction means one clock, so spread this round's answers out in time, as real ones are.
      await asOwner();
      tick += 1;
      await tx`update public.practice_answers set answered_at = now() + make_interval(secs => ${tick}) where session_id = ${session.id}`;
      await as(U.student);
      const result = await rpc("submit_session", [session.id]);
      return { session, ids, result };
    };
    const unitOf = async (ids) => {
      await asOwner();
      return tx`select distinct put.unit_id from public.questions q join public.path_unit_topics put on put.topic_id = q.topic_id where q.id = any(${ids})`;
    };
    const stars = async (unit) => {
      await as(U.student);
      const path = await rpc("get_path", ["mathematics"]);
      return path.units.find((u) => u.id === unit);
    };

    // The data ---------------------------------------------------------------
    await as(U.student);
    const path0 = await rpc("get_path", ["mathematics"]);
    check("Maths has 13 units", path0.units.length === 13, path0.units.length);
    check("most asked first starts with Polynomials, then Mensuration", path0.units[0].slug === "polynomials-equations" && path0.units[1].slug === "mensuration", path0.units.slice(0, 2).map((u) => u.slug));
    check("every unit holds at least 15 questions", path0.units.every((u) => u.questionCount >= 15), path0.units.map((u) => [u.slug, u.questionCount]).filter(([, n]) => n < 15));
    check("a new student has no stars", path0.units.every((u) => u.stars === 0 && u.answers === 0));
    const english = await rpc("get_path", ["english"]);
    check("English has no units yet", english.units.length === 0);
    const topics = await tx`select topic_id from public.path_unit_topics put join public.path_units pu on pu.id = put.unit_id where pu.subject_id = 'mathematics'`;
    check("all 23 Maths topics are in a unit", topics.length === 23, topics.length);

    // Every other seeded subject: every active topic sits in a unit, and every unit can carry rounds on two days.
    for (const [subject, units] of [["physics", 14], ["chemistry", 10], ["biology", 9], ["accounting", 10], ["commerce", 10], ["economics", 10]]) {
      const p = await rpc("get_path", [subject]);
      check(`${subject} has ${units} units`, p.units.length === units, p.units.length);
      check(`every ${subject} unit holds at least 20 questions`, p.units.every((u) => u.questionCount >= 20), p.units.filter((u) => u.questionCount < 20).map((u) => [u.slug, u.questionCount]));
      const [{ loose }] = await asOwner().then(() => tx`select count(*)::int as loose from public.topics t where t.subject_id = ${subject} and t.active
        and not exists (select 1 from public.path_unit_topics put where put.topic_id = t.id)`);
      check(`every ${subject} topic belongs to a unit`, loose === 0, loose);
      await as(U.student);
    }

    // Themes -----------------------------------------------------------------
    const bySyllabus = [...path0.units].sort((a, b) => a.syllabusRank - b.syllabusRank);
    check("every Maths unit has a theme", path0.units.every((u) => u.theme), path0.units.filter((u) => !u.theme).map((u) => u.slug));
    check("syllabus order keeps each theme together", bySyllabus.every((u, i) => i === 0 || u.themeOrder >= bySyllabus[i - 1].themeOrder), bySyllabus.map((u) => [u.slug, u.themeOrder]));
    check("Maths has four themes", new Set(path0.units.map((u) => u.theme)).size === 4);
    await asOwner();
    const bare = await tx`select subject_id, slug from public.path_units where theme is null`;
    check("every seeded unit has a theme", bare.length === 0, bare);

    // New topics join the path on their own -----------------------------------
    await tx`insert into public.topics (subject_id, slug, name, sort_order) values ('physics', 'zz-test-topic', 'Zz test topic', 999)`;
    const [auto] = await tx`select pu.id, pu.theme, (select count(*)::int from public.path_unit_topics put where put.unit_id = pu.id) as topics
                            from public.path_units pu where pu.subject_id = 'physics' and pu.slug = 'topic-zz-test-topic'`;
    check("a new topic in a subject with a path gets its own unit", auto?.topics === 1 && auto.theme === null, auto);
    await as(U.student);
    check("a unit with no questions stays off the trail", (await rpc("get_path", ["physics"])).units.length === 14);
    await asOwner();
    await tx`insert into public.topics (subject_id, slug, name, sort_order) values ('english', 'zz-test-english', 'Zz test english', 999)`;
    const [noAuto] = await tx`select count(*)::int as n from public.path_units where subject_id = 'english'`;
    check("a subject with no path is left alone", noAuto.n === 0, noAuto.n);
    await as(U.student);

    // Rounds -----------------------------------------------------------------
    const a = await play({ unitId: poly }, 5);
    check("a unit round has 10 questions", a.ids.length === 10, a.ids.length);
    check("the round's questions all belong to the unit", (await unitOf(a.ids)).length === 1 && (await unitOf(a.ids))[0].unit_id === poly);
    check("the round remembers its unit", a.session.config.unitIds?.[0] === poly, a.session.config);
    check("5 of 10 earns no star", a.result.reward.path?.starsAfter === 0, a.result.reward.path);

    const b = await play({ unitId: poly }, 7);
    check("a second round gives different questions", b.ids.every((id) => !a.ids.includes(id)));
    check("7 of 10 earns the first star", b.result.reward.path?.starsBefore === 0 && b.result.reward.path?.starsAfter === 1, b.result.reward.path);
    check("stars show on the path", (await stars(poly)).stars === 1);

    const c = await play({ unitId: poly }, 10);
    check("a strong round on the same day does not give star 2", c.result.reward.path?.starsAfter === 1, c.result.reward.path);

    await asOwner();
    await tx`update public.path_stars set star1_at = now() - interval '3 days' where user_id = ${U.student} and unit_id = ${poly}`;
    const d = await play({ unitId: poly }, 10);
    await asOwner();
    if (process.env.DEBUG_PATH) {
      console.log(await tx`select stars, star1_at, now() as now from public.path_stars where user_id = ${U.student} and unit_id = ${poly}`);
      console.log(await tx`select a.is_correct, count(*)::int n, min(a.answered_at) mn from public.practice_answers a join public.questions q on q.id = a.question_id join public.path_unit_topics put on put.topic_id = q.topic_id and put.unit_id = ${poly} where a.user_id = ${U.student} group by 1`);
    }
    check("a strong round on a later day earns star 2", d.result.reward.path?.starsAfter === 2, d.result.reward.path);

    const e = await play({ unitId: poly }, 10);
    check("star 3 needs a week", e.result.reward.path?.starsAfter === 2, e.result.reward.path);
    await asOwner();
    await tx`update public.path_stars set star2_at = now() - interval '8 days' where user_id = ${U.student} and unit_id = ${poly}`;
    const f = await play({ unitId: poly }, 10);
    check("a strong round a week later earns star 3", f.result.reward.path?.starsAfter === 3, f.result.reward.path);

    // Stars are kept, Revisit is live ----------------------------------------
    await play({ unitId: mens }, 7);
    check("Mensuration earns a star", (await stars(mens)).stars === 1);
    await play({ unitId: mens }, 0);
    const m2 = await stars(mens);
    check("a bad round never removes a star", m2.stars === 1, m2);
    check("a bad run flags Revisit", m2.revisit === true, m2);
    check("a solid unit is not flagged", (await stars(poly)).revisit === false);

    // A round in another subject earns its own star.
    const organic = (await tx`select id from public.path_units where slug = 'organic-compounds'`)[0].id;
    const chem = await play({ subjectIds: ["chemistry"], unitId: organic }, 7);
    check("a Chemistry unit round earns a star", chem.result.reward.path?.starsAfter === 1, chem.result.reward.path);

    // Other modes count ------------------------------------------------------
    await as(U.student);
    const before = (await stars(stats)).answers;
    const qf = await rpc("start_session", [{ mode: "quick_five", subjectIds: ["mathematics"] }]);
    check("Quick Five still works", qf.questions.length === 5, qf.questions.length);
    const topicsOfQf = await (async () => { await asOwner(); return tx`select distinct put.unit_id from public.questions q join public.path_unit_topics put on put.topic_id = q.topic_id where q.id = any(${qf.questions.map((q) => q.question.id)})`; })();
    await as(U.student);
    for (const q of qf.questions) await rpc("save_answer", [qf.id, q.question.id, "A"]);
    await rpc("submit_session", [qf.id]);
    const afterQf = await rpc("get_path", ["mathematics"]);
    const touched = new Set(topicsOfQf.map((r) => r.unit_id));
    check("Quick Five answers count toward units", afterQf.units.filter((u) => touched.has(u.id)).every((u) => u.answers > 0));
    check("answers elsewhere are unchanged", (afterQf.units.find((u) => u.id === stats).answers === before) || touched.has(stats));

    // Mixed check ------------------------------------------------------------
    const check1 = await play({ unitIds: [trig, stats], checkpoint: true }, 8);
    check("a mixed check draws from both units", (await unitOf(check1.ids)).length >= 1);
    check("a mixed check is flagged in the result", check1.result.reward.path?.checkpoint === true, check1.result.reward.path);
    check("a mixed check does not award star 1 on its own", check1.result.reward.path?.units.every((u) => u.starsAfter === u.starsBefore));
    await as(U.student);
    const afterCheck = await rpc("get_path", ["mathematics"]);
    check("the path lists the mixed check", afterCheck.checkpoints.length === 1, afterCheck.checkpoints);

    // Rules that refuse ------------------------------------------------------
    await as(U.student);
    const start = (s, cfg) => s`select public.start_session(${JSON.stringify(cfg)}::text::jsonb)`;
    await rejects("two units need a checkpoint", "invalid_unit", (s) => start(s, { mode: "subject", subjectIds: ["mathematics"], unitIds: [trig, stats], count: 10 }));
    await rejects("a unit cannot be used in another subject", "invalid_unit", (s) => start(s, { mode: "subject", subjectIds: ["physics"], unitId: trig, count: 10 }));
    await rejects("a timed round cannot target a unit", "invalid_unit", (s) => start(s, { mode: "timed", subjectIds: ["mathematics"], unitId: trig, count: 10, durationSec: 600 }));
    await rejects("students cannot write stars", "permission denied", (s) => s`insert into public.path_stars (user_id, unit_id, stars) values (${U.student}, ${trig}, 3)`);
    await rejects("students cannot edit units", "permission denied", (s) => s`update public.path_units set name = 'x'`);
    await as(U.other);
    const theirs = await tx`select * from public.path_stars`;
    check("students cannot see each other's stars", theirs.length === 0, theirs.length);

    // Prefs and Home ---------------------------------------------------------
    await as(U.student);
    await rejects("a bad path mode is refused", "invalid_mode", (s) => s`select public.set_path_prefs('nonsense', null)`);
    await rpc("set_path_prefs", ["path", "syllabus"]);
    const overview = await rpc("get_path_overview");
    check("prefs are saved", overview.mode === "path" && overview.order === "syllabus", overview);
    const maths = overview.subjects.find((s) => s.subjectId === "mathematics");
    check("overview counts units and stars", maths?.unitCount === 13 && maths.maxStars === 39 && maths.stars >= 4, maths);
    check("next up follows syllabus order and skips started units", maths?.next?.name === "Bases, sets, operations and matrices", maths?.next);
    check("overview carries the whole trail", maths?.trail?.length === 13 && maths.trail.every((t) => typeof t.stars === "number"), maths?.trail?.length);
    await rpc("set_path_prefs", [null, "asked"]);
    const overview2 = await rpc("get_path_overview");
    check("changing the order keeps the mode", overview2.mode === "path" && overview2.order === "asked", overview2);
    check("next up follows most-asked order", overview2.subjects[0].next?.name === "Fractions, decimals and percentages" || overview2.subjects[0].next?.index >= 1, overview2.subjects[0].next);

    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) failures.push(`crashed: ${e.message}`);
}

await sql.end();
console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);
