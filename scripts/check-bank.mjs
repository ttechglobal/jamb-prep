// Read-only health check of the loaded question bank. Run: npm run db:check
// Plays a real mock and Quick Five as a student inside a transaction that is always rolled back.
import postgres from "postgres";

const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false, onnotice: () => {} });
class Rollback extends Error {}
const USER = "00000000-0000-4000-8000-0000000000aa";
let failed = false;
const check = (name, ok, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} ${detail}`);
};

try {
  await sql.begin(async (tx) => {
    const bySubject = await tx`select subject_id, count(*)::int as n, count(topic_id)::int as tagged
      from public.questions where status = 'published' group by 1 order by 1`;
    console.log(bySubject.map((r) => `${r.subject_id} ${r.n} (${r.tagged} tagged)`).join(", "));

    const [{ bad }] = await tx`select count(*)::int as bad from public.questions
      where not public.is_valid_question_options(options) or not public.has_content(stem)`;
    check("every published question is complete", bad === 0, bad);
    const [{ missing }] = await tx`select count(*)::int as missing from public.questions q
      where q.status = 'published' and not exists (select 1 from public.question_solutions s where s.question_id = q.id)`;
    check("every published question has an answer", missing === 0, missing);

    await tx`insert into auth.users (id, aud, role, email, is_anonymous) values (${USER}, 'authenticated', 'authenticated', 'check@example.test', false)`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: USER, role: "authenticated", is_anonymous: false })}, true)`;
    await tx.unsafe("set local role authenticated");
    const rpc = async (name, args) => {
      const list = args.map((a, i) => (typeof a === "object" ? `$${i + 1}::text::jsonb` : `$${i + 1}`)).join(",");
      const values = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : a));
      return (await tx.unsafe(`select public.${name}(${list}) as r`, values))[0].r;
    };

    await rpc("complete_onboarding", ["Ada", { english: 70, mathematics: 70, chemistry: 70, accounting: 70 }]);
    const started = Date.now();
    const mock = await rpc("start_session", [{ mode: "mock", subjectIds: ["english", "mathematics", "chemistry", "accounting"] }]);
    const payload = JSON.stringify(mock);
    check("a mock has 180 questions", mock.questions.length === 180, mock.questions.length);
    console.log(`     started in ${Date.now() - started} ms, ${Math.round(payload.length / 1024)} KB`);
    // Field names, not text: real questions mention "aqueous solution" and "correct".
    const fields = new Set();
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
        fields.add(k);
        walk(x);
      }
    };
    walk(mock);
    const secret = [...fields].filter((k) => /correct|solution|explanation|hint|wrongOptions|studyTip/i.test(k));
    check("a mock carries no answers", secret.length === 0 && Object.keys(mock.reveals).length === 0, secret.join(","));
    console.log(`     fields sent: ${[...fields].sort().join(", ")}`);

    for (const q of mock.questions.slice(0, 20)) await rpc("save_answer", [mock.id, q.question.id, "A"]);
    await rpc("submit_session", [mock.id]);
    const result = await rpc("get_results", [mock.id]);
    check("the mock scores and reviews", result.answered === 20 && result.review.length === 180, `${result.correct}/20 correct, UTME ${result.utmeScore}`);
    check("review carries solutions", result.review.every((r) => r.reveal?.correctOption && r.reveal?.solution?.answer));

    const quick = await rpc("start_session", [{ mode: "quick_five", subjectIds: ["crk"] }]);
    const answer = await rpc("save_answer", [quick.id, quick.questions[0].question.id, "B"]);
    check("Quick Five reveals after answering", quick.questions.length === 5 && !!answer.reveal?.correctOption);
    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) check("check finished", false, e.message);
}

const figures = await sql`select s.solution -> 'figures' -> 0 ->> 'src' as src from public.question_solutions s where s.solution ? 'figures'`;
for (const { src } of figures) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/question-media/${src}`);
  check("figure loads", res.ok && res.headers.get("content-type")?.includes("svg"), src);
}
await sql.end();
process.exit(failed ? 1 : 0);
