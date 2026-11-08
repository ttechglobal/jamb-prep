# Prompt for the Exam Prep A1 chat

Paste everything below the line into the chat that has access to the old question bank.

---

I need a read-only export of every JAMB question from this project, so a new JAMB-only project can import them. Do not change anything in this project.

**Hard rules**
- Read only. No INSERT, UPDATE, DELETE, DDL, migrations, RPCs that write, or Storage changes. Run the export inside a read-only transaction (`BEGIN TRANSACTION READ ONLY`).
- Do not clean, fix, reformat, deduplicate or filter the content. I want the rows exactly as stored, including inactive, flagged and broken rows. The new project applies its own rules.
- Do not export student data: no `question_attempts`, `account_topic_results` or `profiles`, and no `student_id` values.
- Do not put keys, connection strings or passwords in the output files, in code you commit, or in your replies.
- Do not commit the export files to this repository, and do not upload them anywhere. Write them to a folder outside the repo, or to a gitignored folder.

**Rows to export**

All rows where `questions.exam_types @> ARRAY['JAMB']::text[]`. An earlier audit found 6,218 rows, of which 6,106 are active.

Do not use the Supabase SQL editor to download the results, because it can truncate large results. Use a small local script (Node or similar) that reads the database and writes the file. Page through the rows ordered by `id`, or use a cursor, so nothing is cut off.

Use this query as the shape of each row, and adjust it only if a column name differs:

```sql
select
  to_jsonb(q)
  || jsonb_build_object(
       'subject_name',  s.name,
       'subject_slug',  s.slug,
       'topic_name',    t.name,
       'topic_slug',    t.slug,
       'subtopic_name', st.name,
       'subtopic_slug', st.slug,
       'flag_summary',  coalesce(f.flag_summary, '[]'::jsonb)
     ) as row
from public.questions q
join public.subjects s on s.id = q.subject_id
left join public.topics t on t.id = q.topic_id
left join public.subtopics st on st.id = q.subtopic_id
left join lateral (
  select jsonb_agg(jsonb_build_object('reason', x.reason, 'count', x.n)) as flag_summary
  from (
    select reason, count(*) as n
    from public.question_flags
    where question_id = q.id
    group by reason
  ) x
) f on true
where q.exam_types @> ARRAY['JAMB']::text[]
order by q.id;
```

**Files to produce**

1. `jamb_questions.jsonl`: one JSON object per line, UTF-8, one line per question. Keep `options`, `explanation` and any SVG strings as real JSON, not as escaped text inside a string. Preserve ₦, ⁻³, ₂, curly quotes and all other Unicode exactly.
2. `jamb_taxonomy.json`: `{ "subjects": [...], "topics": [...], "subtopics": [...] }` covering every subject, topic and subtopic that an exported question references, plus any others with `exam_type` JAMB. Include `id`, `slug`, `name`, `order_index`, the parent id, `exam_type`, and for subtopics `objectives` and `exam_frequency`. Leave out `lesson_content`, `generation_prompt`, the raw curriculum fields and the admin review fields.
3. `manifest.json` containing:
   - when the export ran
   - total rows and active rows
   - counts of total and active rows per subject
   - counts per year
   - how many rows have each of these populated: `passage_text`, `passage_image_url`, `image_url`, `instruction_text`, `hint`, `topic_id`, `subtopic_id`
   - how many rows have `explanation.svg_diagram`, and how many have `explanation.question_diagram` with a non-null `svg` or `image_url`
   - the SHA-256 and byte size of the other two files

**Check before you finish**

Reload `jamb_questions.jsonl` from disk, parse every line, and confirm:
- the line count equals the database count run in the same session
- every `id` is unique
- the per-subject totals match the database
- these three IDs are present: `fb7a856e-8cee-4a22-bdde-7548d2ab4ea4`, `20bf0d2e-f782-4076-88ad-f26479df1d10`, `8173cb1c-7c0b-4440-8878-80c022f5cd81`

Compare the totals with this earlier audit and report any difference. Do not try to fix a difference.

| Subject | Total | Active |
|---|---:|---:|
| Accounting | 754 | 754 |
| Biology | 440 | 440 |
| Chemistry | 680 | 680 |
| Commerce | 480 | 480 |
| CRK | 480 | 480 |
| Economics | 560 | 560 |
| English Language | 270 | 202 |
| Government | 640 | 640 |
| Literature in English | 201 | 197 |
| Mathematics | 717 | 717 |
| Physics | 956 | 956 |
| The Lekki Headmaster | 40 | 0 |
| **Total** | **6,218** | **6,106** |

**When you are done, tell me:**
- the full path of the three files
- the manifest totals
- any difference from the audit
- any images held in the `question-images` Storage bucket that JAMB rows reference. List the rows and paths only. Do not download or change anything.
