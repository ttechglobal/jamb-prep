// Runs against the real database inside one transaction that is always rolled back,
// so no test user or question is ever left behind.
// Run: npm run db:test
import postgres from "postgres";

const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false, onnotice: () => {} });

const U = {
  student: "00000000-0000-4000-8000-000000000001",
  guest: "00000000-0000-4000-8000-000000000002",
  other: "00000000-0000-4000-8000-000000000003",
};
const SUBJECTS = ["english", "mathematics", "physics", "chemistry"];
const KEYS = ["A", "B", "C", "D"];
const blocks = (text) => [{ type: "paragraph", content: [{ text }] }];
const optionsFor = (label) => KEYS.map((key) => ({ key, blocks: blocks(`${label} ${key}`) }));

let passed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) passed++;
  else failures.push(`${name}${detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
}

class Rollback extends Error {}

try {
  await sql.begin(async (tx) => {
    const as = async (user, guest = false) => {
      await tx.unsafe("reset role");
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: user, role: "authenticated", is_anonymous: guest })}, true)`;
      await tx.unsafe("set local role authenticated");
    };
    const asOwner = () => tx.unsafe("reset role");
    const rpc = async (name, args) => {
      // Sent as text then cast, because the client double-encodes strings bound to jsonb.
      const isJson = (a) => typeof a === "object" && a !== null;
      const list = args.map((a, i) => (isJson(a) ? `$${i + 1}::text::jsonb` : `$${i + 1}`)).join(", ");
      const values = args.map((a) => (isJson(a) ? JSON.stringify(a) : a));
      const [row] = await tx.unsafe(`select public.${name}(${list}) as r`, values);
      return row.r;
    };
    // A negative test only counts if it fails for the expected reason.
    const rejects = async (name, expected, fn) => {
      try {
        await tx.savepoint(fn);
        check(name, false, "was allowed");
      } catch (e) {
        check(name, e.message.includes(expected), e.message);
      }
    };

    // Setup ------------------------------------------------------------------
    for (const [key, id] of Object.entries(U)) {
      await tx`insert into auth.users (id, aud, role, email, is_anonymous)
               values (${id}, 'authenticated', 'authenticated', ${key === "guest" ? null : `${key}@example.test`}, ${key === "guest"})`;
    }
    // The real bank stays out of these tests. The transaction rolls this back.
    await tx`update public.questions set status = 'retired'`;
    for (const subject of SUBJECTS) {
      const want = subject === "english" ? 70 : 50;
      for (let i = 0; i < want; i++) {
        const [q] = await tx`insert into public.questions (subject_id, stem, options, status)
                 values (${subject}, ${tx.json(blocks(`${subject} question ${i}`))}, ${tx.json(optionsFor(`${subject} ${i} option`))}, 'published')
                 returning id`;
        await tx`insert into public.question_solutions (question_id, correct_option, solution)
                 values (${q.id}, 'B', ${tx.json({ answer: blocks("Because B.") })})`;
      }
    }

    const correctFor = async (id) => {
      await asOwner();
      const [q] = await tx`select correct_option from public.question_solutions where question_id = ${id}`;
      return q.correct_option;
    };

    // Accounts ---------------------------------------------------------------
    const [profile] = await tx`select role from public.profiles where id = ${U.student}`;
    check("signup creates a student profile", profile?.role === "student");
    const [progress] = await tx`select xp from public.player_progress where user_id = ${U.guest}`;
    check("guests get a progress row", progress?.xp === 0);

    // Row-level security on every table --------------------------------------
    const open = await tx`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    check("every public table has RLS on", open.length === 0, open.map((r) => r.relname));
    const noPath = await tx`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname in ('public', 'private') and p.prosecdef
                              and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`;
    check("definer functions pin search_path", noPath.length === 0, noPath.map((r) => r.proname));

    // Answer secrecy ---------------------------------------------------------
    await as(U.student);
    const visible = await tx`select id from public.questions`;
    check("students cannot read the questions table", visible.length === 0, visible.length);
    await rejects("session question links are not readable", "permission denied", (s) => s`select * from public.practice_session_questions`);

    await tx.unsafe("reset role");
    await tx`select set_config('request.jwt.claims', '{}', true)`;
    await tx.unsafe("set local role anon");
    await rejects("anon cannot touch questions", "permission denied", (s) => s`select * from public.questions`);
    await rejects("anon cannot start a session", "permission denied", (s) => s`select public.start_session('{"mode":"quick_five","subjectIds":["english"]}')`);
    const reference = await tx`select id from public.subjects`;
    check("anon can read subjects", reference.length === 12, reference.length);

    await as(U.student);
    await rejects("students cannot make themselves admin", "permission denied", (s) => s`update public.profiles set role = 'admin' where id = ${U.student}`);
    await rejects("students cannot edit their XP", "permission denied", (s) => s`update public.player_progress set xp = 99999 where user_id = ${U.student}`);
    await rejects("students cannot insert questions", "row-level security", (s) => s`insert into public.questions (subject_id, stem, options) values ('english', ${s.json(blocks("x"))}, ${s.json(optionsFor("student"))})`);
    const solutions = await tx`select question_id from public.question_solutions`;
    check("students cannot read solutions", solutions.length === 0, solutions.length);
    const contexts = await tx`select id from public.shared_contexts`;
    check("students cannot read the context table", contexts.length === 0, contexts.length);

    // Onboarding -------------------------------------------------------------
    const onboard = (s, subjects, target, name = "Ada") =>
      s`select public.complete_onboarding(${name}, ${s.json(Object.fromEntries(subjects.map((id) => [id, target])))})`;
    await rejects("onboarding needs English", "invalid_subjects", (s) => onboard(s, ["mathematics", "physics", "chemistry", "biology"], 70));
    await rejects("onboarding needs four subjects", "invalid_subjects", (s) => onboard(s, ["english", "physics", "chemistry"], 70));
    await rejects("onboarding needs a name", "invalid_name", (s) => onboard(s, SUBJECTS, 70, " "));
    await rejects("targets stop at 100 per subject", "invalid_target", (s) => onboard(s, SUBJECTS, 101));
    await rejects("targets cannot be negative", "invalid_target", (s) => onboard(s, SUBJECTS, -5));
    await rejects("targets are whole numbers", "invalid_target", (s) => onboard(s, SUBJECTS, 70.5));
    await onboard(tx, SUBJECTS, 70);
    const mine = await tx`select subject_id, target_score from public.student_subjects`;
    check("onboarding saves subjects", mine.length === 4, mine.length);
    check("each subject keeps its target, totalling 280", mine.reduce((sum, r) => sum + r.target_score, 0) === 280, mine);
    await onboard(tx, ["english", "biology", "physics", "chemistry"], 60);
    const changed = await tx`select subject_id from public.student_subjects where subject_id = 'mathematics'`;
    check("changing subjects replaces the old set", changed.length === 0, changed.length);
    await onboard(tx, SUBJECTS, 70);

    await as(U.guest, true);
    await rejects("guests cannot onboard", "account_required", (s) => onboard(s, SUBJECTS, 70));

    // Quick Five: instant feedback -------------------------------------------
    await as(U.student);
    const qf = await rpc("start_session", [{ mode: "quick_five", subjectIds: ["physics"], count: 500 }]);
    check("Quick Five is always 5 questions", qf.questions.length === 5, qf.questions.length);
    const payload = JSON.stringify(qf);
    check("session payload hides answers", !payload.includes("correct") && !payload.includes("solution") && !payload.includes("Because"));

    const qfIds = qf.questions.map((q) => q.question.id);
    const first = await rpc("save_answer", [qf.id, qfIds[0], "B"]);
    check("instant mode reveals after answering", first.reveal?.correctOption === "B" && first.reveal?.solution?.answer?.[0]?.content?.[0]?.text === "Because B.", first);
    await rpc("save_answer", [qf.id, qfIds[0], "C"]);
    const reloaded = await rpc("get_session", [qf.id]);
    check("revealed answers are locked", reloaded.answers[qfIds[0]] === "B", reloaded.answers[qfIds[0]]);
    check("only answered questions are revealed", Object.keys(reloaded.reveals).length === 1);

    const beforeSubmit = await tx`select * from public.practice_answers where session_id = ${qf.id}`;
    check("answers stay hidden until the session closes", beforeSubmit.length === 0, beforeSubmit.length);

    await as(U.other);
    check("others cannot read my session", (await rpc("get_session", [qf.id])) === null);
    await rejects("others cannot answer in my session", "session_not_found", (s) => s`select public.save_answer(${qf.id}::uuid, ${qfIds[1]}::uuid, 'A')`);
    await rejects("others cannot submit my session", "session_not_found", (s) => s`select public.submit_session(${qf.id}::uuid)`);
    check("others cannot read my results", (await rpc("get_results", [qf.id])) === null);

    await as(U.student);
    check("no results before submitting", (await rpc("get_results", [qf.id])) === null);
    await rpc("save_answer", [qf.id, qfIds[1], "B"]);
    await rpc("save_answer", [qf.id, qfIds[2], "B"]);
    await rpc("save_answer", [qf.id, qfIds[3], "B"]);
    await rpc("save_answer", [qf.id, qfIds[4], "A"]);
    const result = await rpc("submit_session", [qf.id]);
    check("scores 4 of 5", result.correct === 4 && result.total === 5 && result.accuracy === 80, result);
    check("awards 10 XP and 2 stars", result.reward.xpGained === 10 && result.reward.stars === 2, result.reward);
    check("first practice starts a streak", result.reward.streak === 1, result.reward);
    check("results include the review", result.review.length === 5 && result.review[0].reveal.correctOption === "B");
    await rpc("submit_session", [qf.id]);
    const [afterTwice] = await tx`select xp, sessions_completed, day_questions, subjects from public.player_progress`;
    check("submitting twice awards once", afterTwice.xp === 10 && afterTwice.sessions_completed === 1, afterTwice);
    check("subject stats update", afterTwice.subjects.physics.answered === 5 && afterTwice.subjects.physics.correct === 4, afterTwice.subjects);
    await rejects("closed sessions reject answers", "session_closed", (s) => s`select public.save_answer(${qf.id}::uuid, ${qfIds[0]}::uuid, 'A')`);

    // Timed: answers stay hidden, the deadline is enforced -------------------
    const timed = await rpc("start_session", [{ mode: "timed", subjectIds: ["mathematics"], count: 3, durationSec: 600, feedback: "instant" }]);
    check("the client cannot request instant answers", timed.config.feedback === "end", timed.config);
    const tIds = timed.questions.map((q) => q.question.id);
    const hidden = await rpc("save_answer", [timed.id, tIds[0], "A"]);
    check("timed mode reveals nothing", Object.keys(hidden).length === 0, hidden);
    await rpc("save_answer", [timed.id, tIds[0], "B"]);
    const edited = await rpc("get_session", [timed.id]);
    check("timed answers can change", edited.answers[tIds[0]] === "B");

    await asOwner();
    await tx`update public.practice_sessions set started_at = now() - interval '11 minutes', deadline_at = now() - interval '1 minute' where id = ${timed.id}`;
    await as(U.student);
    await rejects("late answers are rejected", "session_closed", (s) => s`select public.save_answer(${timed.id}::uuid, ${tIds[1]}::uuid, 'B')`);
    const expired = await rpc("get_session", [timed.id]);
    check("expired sessions finalise themselves", expired.status === "expired", expired.status);
    const expiredResult = await rpc("get_results", [timed.id]);
    check("expired work still counts", expiredResult.answered === 1 && expiredResult.correct === 1 && expiredResult.durationSec === 600, expiredResult);

    await rejects("bad modes are rejected", "invalid_mode", (s) => s`select public.start_session('{"mode":"cheat"}')`);
    await rejects("oversized sessions are rejected", "invalid_count", (s) => s`select public.start_session('{"mode":"subject","subjectIds":["physics"],"count":5000}')`);

    // Guests can practise, but not mock --------------------------------------
    await as(U.guest, true);
    const guestRound = await rpc("start_session", [{ mode: "quick_five", subjectIds: ["english"] }]);
    check("guests can practise", guestRound.questions.length === 5);
    const guestSecond = await rpc("start_session", [{ mode: "quick_five", subjectIds: ["physics"] }]);
    check("guests get a second round", guestSecond.questions.length === 5);
    await rejects("a third guest round needs an account", "account_required", (s) => s`select public.start_session('{"mode":"quick_five","subjectIds":["english"]}')`);
    const stillOpen = await rpc("get_session", [guestRound.id]);
    check("guests can still finish a started round", stillOpen?.status === "in_progress");
    await rejects("mock needs an account", "account_required", (s) => s`select public.start_session('{"mode":"mock"}')`);

    // XP: 2 per correct, 2 for finishing, 2 more for three stars. Wrong answers earn nothing.
    await as(U.student);
    const perfect = await rpc("start_session", [{ mode: "quick_five", subjectIds: ["physics"] }]);
    for (const q of perfect.questions) await rpc("save_answer", [perfect.id, q.question.id, "B"]);
    const perfectResult = await rpc("submit_session", [perfect.id]);
    check("a perfect round earns 14 XP and 3 stars", perfectResult.reward.xpGained === 14 && perfectResult.reward.stars === 3, perfectResult.reward);
    const allWrong = await rpc("start_session", [{ mode: "quick_five", subjectIds: ["physics"] }]);
    for (const q of allWrong.questions) await rpc("save_answer", [allWrong.id, q.question.id, "A"]);
    const wrongResult = await rpc("submit_session", [allWrong.id]);
    check("all wrong earns only the finishing bonus", wrongResult.reward.xpGained === 2 && wrongResult.reward.stars === 0, wrongResult.reward);
    await as(U.student);
    const empty = await rpc("start_session", [{ mode: "quick_five", subjectIds: ["physics"] }]);
    const emptyResult = await rpc("submit_session", [empty.id]);
    check("an unanswered round earns nothing", emptyResult.reward.xpGained === 0, emptyResult.reward);

    // Mock -------------------------------------------------------------------
    await as(U.student);
    const mock = await rpc("start_session", [{ mode: "mock", subjectIds: ["physics"], durationSec: 999999 }]);
    check("mock is 180 questions", mock.questions.length === 180, mock.questions.length);
    check("mock uses the student's subjects, English first", mock.config.subjectIds.length === 4 && mock.config.subjectIds[0] === "english", mock.config.subjectIds);
    check("mock is timed by the format, not the client", mock.config.durationSec === 7200, mock.config.durationSec);
    const bySubject = {};
    for (const q of mock.questions) bySubject[q.question.subjectId] = (bySubject[q.question.subjectId] ?? 0) + 1;
    check("mock allocation is 60/40/40/40", bySubject.english === 60 && bySubject.mathematics === 40 && bySubject.physics === 40 && bySubject.chemistry === 40, bySubject);

    // English: all correct. Maths: half correct. Others blank.
    const english = mock.questions.filter((q) => q.question.subjectId === "english");
    const maths = mock.questions.filter((q) => q.question.subjectId === "mathematics");
    for (const q of english) await rpc("save_answer", [mock.id, q.question.id, "B"]);
    for (const [i, q] of maths.entries()) await rpc("save_answer", [mock.id, q.question.id, i % 2 ? "A" : "B"]);
    const mockResult = await rpc("submit_session", [mock.id]);
    const score = Object.fromEntries(mockResult.bySubject.map((s) => [s.subjectId, s.scaledScore]));
    check("mock scales each subject to 100", score.english === 100 && score.mathematics === 50 && score.physics === 0 && score.chemistry === 0, score);
    check("mock total is out of 400", mockResult.utmeScore === 150, mockResult.utmeScore);

    // Streaks ----------------------------------------------------------------
    await asOwner();
    await tx`update public.player_progress set last_practice_day = (now() at time zone 'Africa/Lagos')::date - 1, current_streak = 4 where user_id = ${U.other}`;
    await as(U.other);
    const nextDay = await rpc("start_session", [{ mode: "quick_five", subjectIds: ["english"] }]);
    await rpc("save_answer", [nextDay.id, nextDay.questions[0].question.id, "B"]);
    const nextDayResult = await rpc("submit_session", [nextDay.id]);
    check("practising the next day extends a streak", nextDayResult.reward.streak === 5, nextDayResult.reward);

    await asOwner();
    await tx`update public.player_progress set last_practice_day = (now() at time zone 'Africa/Lagos')::date - 3, current_streak = 4 where user_id = ${U.other}`;
    await as(U.other);
    const missed = await rpc("start_session", [{ mode: "quick_five", subjectIds: ["english"] }]);
    await rpc("save_answer", [missed.id, missed.questions[0].question.id, "B"]);
    const missedResult = await rpc("submit_session", [missed.id]);
    check("a missed day resets a streak", missedResult.reward.streak === 1, missedResult.reward);

    // Question bank rules ----------------------------------------------------
    await asOwner();
    const opts = KEYS.map((key, i) => ({ key, blocks: blocks(`unique ${i}`) }));
    const five = [...opts, { key: "E", blocks: blocks("fifth") }];
    const stem = (text) => tx.json(blocks(text));
    const enforce = (s) => s`set constraints all immediate`;
    await tx`insert into public.questions (subject_id, stem, options, status) values ('english', ${stem("a five option draft")}, ${tx.json(five)}, 'draft')`;
    check("drafts can hold five options", true);
    await rejects("five options cannot publish", "published_options_are_complete", (s) => s`update public.questions set status = 'published' where stem = ${s.json(blocks("a five option draft"))}`);
    const emptyOption = opts.map((o, i) => (i === 3 ? { ...o, blocks: blocks("  ") } : o));
    await rejects("a blank option cannot publish", "published_options_are_complete", (s) => s`insert into public.questions (subject_id, stem, options, status) values ('english', ${s.json(blocks("blank option"))}, ${s.json(emptyOption)}, 'published')`);
    await rejects("a blank stem is rejected", "questions_stem_check", (s) => s`insert into public.questions (subject_id, stem, options) values ('english', ${s.json(blocks(" "))}, ${s.json(opts)})`);
    await rejects("publishing needs a correct answer", "published_question_needs_answer", async (s) => {
      await s`insert into public.questions (subject_id, stem, options, status) values ('english', ${s.json(blocks("no answer"))}, ${s.json(opts)}, 'published')`;
      await enforce(s);
    });
    await rejects("a published answer cannot be deleted", "published_question_needs_answer", async (s) => {
      await s`delete from public.question_solutions where question_id = (select id from public.questions where status = 'published' limit 1)`;
      await enforce(s);
    });
    await tx`insert into public.questions (subject_id, stem, options) values ('english', ${stem("Duplicate   Check")}, ${tx.json(opts)})`;
    const reversed = [...opts].reverse().map((o, i) => ({ key: KEYS[i], blocks: o.blocks }));
    await rejects("duplicates are rejected despite spacing and option order", "content_hash", (s) => s`insert into public.questions (subject_id, stem, options) values ('english', ${s.json(blocks("duplicate check"))}, ${s.json(reversed)})`);
    const [passage] = await tx`insert into public.shared_contexts (subject_id, kind, blocks) values ('english', 'passage', ${tx.json(blocks("A different passage"))}) returning id`;
    await tx`insert into public.questions (subject_id, stem, context_id, options) values ('english', ${stem("Duplicate Check")}, ${passage.id}, ${tx.json(opts)})`;
    check("the same stem on a different passage is allowed", true);

    // Rich content reaches the student in the right order --------------------
    const [work] = await tx`insert into public.prescribed_works (title, author) values ('Test Work', 'Test Author') returning id`;
    await tx`insert into public.work_assignments (work_id, paper, from_year, to_year) values (${work.id}, 'use_of_english', 2023, 2025)`;
    const figure = { type: "figure", src: "solutions/secret-figure.svg", alt: "Worked figure" };
    const [rich] = await tx`insert into public.questions (subject_id, stem, context_id, work_id, work_reference, options, status)
                            values ('biology', ${stem("Rich question")}, ${passage.id}, ${work.id}, 'Chapter 1', ${tx.json(optionsFor("rich"))}, 'published') returning id`;
    await tx`insert into public.question_solutions (question_id, correct_option, hint, solution)
             values (${rich.id}, 'C', ${tx.json(blocks("Secret hint"))}, ${tx.json({ answer: blocks("Worked answer"), figures: [figure] })})`;
    await tx`set constraints all immediate`;
    await as(U.student);
    const timedRich = await rpc("start_session", [{ mode: "timed", subjectIds: ["biology"], count: 1, durationSec: 600 }]);
    const shown = timedRich.questions[0].question;
    const before = JSON.stringify(timedRich);
    check("timed payload carries the passage", shown.context?.blocks?.[0]?.content?.[0]?.text === "A different passage", shown.context);
    check("timed payload carries the prescribed work", shown.work?.title === "Test Work" && shown.work?.reference === "Chapter 1", shown.work);
    check("timed payload holds no key, hint or solution figure", !/secret|Worked|correct|solution/i.test(before), before);
    await rpc("save_answer", [timedRich.id, shown.id, "C"]);
    await rpc("submit_session", [timedRich.id]);
    const review = await rpc("get_results", [timedRich.id]);
    const row = review.review[0];
    check("review shows the source and the solution figure", row.reveal?.correctOption === "C" && row.reveal?.solution?.figures?.[0]?.src === figure.src && row.question.context?.id === passage.id, row);
    check("review never sends the hint", !JSON.stringify(review).includes("Secret hint"));
    check("scoring reads the separate answer table", review.correct === 1, review.correct);
    await asOwner();

    // Admin ------------------------------------------------------------------
    await tx`update public.profiles set role = 'admin' where id = ${U.other}`;
    await as(U.other);
    const [added] = await tx`insert into public.questions (subject_id, stem, options)
                             values ('biology', ${tx.json(blocks("Added by an admin"))}, ${tx.json(optionsFor("admin"))}) returning id, content_hash`;
    await tx`insert into public.question_solutions (question_id, correct_option) values (${added.id}, 'C')`;
    await tx`update public.questions set status = 'published' where id = ${added.id}`;
    check("admins can add questions", added?.content_hash?.length === 32, added);
    const seen = await tx`select id from public.questions`;
    check("admins can read the question bank", seen.length > 200, seen.length);
    const [batch] = await tx`insert into public.question_import_batches (source) values ('test') returning id`;
    check("admins can open an import batch", !!batch?.id);
    await as(U.student);
    const hiddenBatches = await tx`select id from public.question_import_batches`;
    check("students cannot see import batches", hiddenBatches.length === 0, hiddenBatches.length);

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
