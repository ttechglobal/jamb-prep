# Adding to the path: subjects, topics and questions

The path reads the bank live, so most growth needs nothing from you.

## What happens on its own

| You add | What happens |
|---|---|
| Questions to an existing topic | Counts update at once. Nothing to do. |
| A new topic to a subject that has a path | A unit of its own is created (`topic-<slug>`) and appears under "More topics" in syllabus order. It stays off the trail until it holds 5 published questions. |
| Questions to a unit that was hidden | It appears as soon as it has 5. |

Group a new topic into a theme later, or leave it alone: it works either way.

## Adding a subject that has tagged topics

1. Run the suggester. It is read-only and prints a migration:

   ```powershell
   npm run path:suggest -- <subject-id>
   ```

   Pass a second number to change the target questions per unit (default 30).
2. Copy the output into `supabase/migrations/<timestamp>_path_units_<subject>.sql`.
3. Edit it: rename the units, set `theme` and `theme_order` for each (these become the section titles in syllabus order), and check the groups make sense. A unit holding fewer than 20 questions is flagged.
4. Test, then apply:

   ```powershell
   npm run db:test:path
   npm run db:push
   ```

The path test runs any unapplied path migration inside a rolled-back transaction first, so a mistake never reaches the database. Add the subject and its unit count to the loop in `supabase/tests/path.test.mjs` so coverage stays checked.

## Regrouping later

Units are rows. To move a topic, update `path_unit_topics.unit_id`. To rename or reorder, update `path_units.name` or `sort_order`. Stars follow the unit, so merging two units keeps the stars of the one you keep.

## Subjects not ready yet

A subject with no units shows "Coming soon". English has a short path (Comprehension, Lexis and Structure; Oral Forms joins once it has 5 questions). Regroup into more units as questions are added and tagged to subtopics; see [path-question-audit.md](path-question-audit.md).
