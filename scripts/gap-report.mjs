// Read-only. Which subject and year papers are missing from the question bank.
//   npm run bank:gaps                 every subject
//   npm run bank:gaps -- english      one subject
// Touches nothing and calls no MyQuest endpoint, so it costs nothing. A "gap" means the bank holds no
// question for that subject and year. MyQuest may not have a paper for every gap, which the fetch step finds out.
import postgres from "postgres";
import { JAMB_FIRST_YEAR, JAMB_LAST_YEAR, MYQUEST_SUBJECTS, SET_TEXTS } from "../lib/myquest/subjects.ts";

const only = process.argv[2];
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false, onnotice: () => {} });

const subjects = await sql`select id, name, active from public.subjects order by name`;
const held = await sql`select subject_id, year, status, count(*)::int as n from public.questions
  where year is not null and status <> 'retired' group by 1, 2, 3`;
const topics = await sql`select subject_id, count(*)::int as n from public.topics group by 1`;
const topicCount = new Map(topics.map((t) => [t.subject_id, t.n]));
const mapped = new Set(Object.values(MYQUEST_SUBJECTS));
const years = Array.from({ length: JAMB_LAST_YEAR - JAMB_FIRST_YEAR + 1 }, (_, i) => JAMB_FIRST_YEAR + i);

let totalGaps = 0;
for (const s of subjects) {
  if (only && s.id !== only) continue;
  const byYear = new Map();
  for (const r of held.filter((h) => h.subject_id === s.id)) byYear.set(r.year, (byYear.get(r.year) ?? 0) + r.n);
  const drafts = held.filter((h) => h.subject_id === s.id && h.status !== "published").reduce((a, r) => a + r.n, 0);
  const gaps = years.filter((y) => !byYear.has(y));
  const thin = years.filter((y) => byYear.has(y) && byYear.get(y) < 20);
  const importable = mapped.has(s.id);
  const total = [...byYear.values()].reduce((a, n) => a + n, 0);
  console.log(`\n${s.name} (${s.id})${s.active ? "" : " [hidden]"}`);
  console.log(`  ${total} questions over ${byYear.size} years, ${topicCount.get(s.id) ?? 0} topics${drafts ? `, ${drafts} drafts` : ""}`);
  if (!importable) console.log("  not mapped to a MyQuest subject, so it cannot be imported");
  console.log(`  missing years (${gaps.length}): ${gaps.join(", ") || "none"}`);
  if (thin.length) console.log(`  thin years, under 20 questions: ${thin.map((y) => `${y} (${byYear.get(y)})`).join(", ")}`);
  if (importable) totalGaps += gaps.length;
}
for (const t of SET_TEXTS) {
  const have = await sql`select year, count(*)::int as n from public.questions where subject_id = ${t.subjectId}
    and work_id is not null and status <> 'retired' group by 1 order by 1`.catch(() => []);
  const got = new Set(have.map((h) => String(h.year)));
  console.log(`\nSet text: ${t.title} (under ${t.subjectId})`);
  console.log(`  MyQuest years ${t.years.join(", ")}; held ${[...got].join(", ") || "none"}; missing ${t.years.filter((y) => !got.has(y)).join(", ") || "none"}`);
}
console.log(`\n${totalGaps} subject-years missing across importable subjects.`);
await sql.end();
