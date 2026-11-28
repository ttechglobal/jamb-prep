# Path readiness: questions per topic

Audited 2026-11-28, read-only, from the live bank (published questions, counts only). Question: can every topic carry a path step of 10 unseen questions, with fresh ones again on a later day?

## The bank

5,550 published questions across 11 subjects. Almost all are tagged to a topic (maths 2 and physics 3 are not).

| Subject | Topics | 20+ questions | 10 to 19 | Under 10 | Questions | In topics of 20+ |
|---|---|---|---|---|---|---|
| Accounting | 18 | 10 | 4 | 4 | 637 | 89% |
| Biology | 21 | 8 | 10 | 3 | 420 | 59% |
| Chemistry | 18 | 11 | 5 | 2 | 627 | 87% |
| Commerce | 16 | 10 | 3 | 3 | 446 | 87% |
| CRK | 46 | 6 | 15 | 25 | 467 | 32% |
| Economics | 23 | 12 | 11 | 0 | 491 | 63% |
| English | 3 | 2 | 0 | 1 | 264 | 98% |
| Government | 33 | 9 | 13 | 11 | 533 | 51% |
| Literature | 3 | 1 | 1 | 1 | 135 | 88% |
| Mathematics | 23 | 10 | 3 | 10 | 560 | 86% |
| Physics | 38 | 16 | 19 | 3 | 963 | 70% |

## What this means

1. **The design's topic counts were wrong.** Maths has 23 topics, not 38. Some are combined (for example "Indices, logarithms and surds" is one topic). The mock-ups need real names and counts.
2. **English and Literature cannot form a path from topics.** English has 3 topics (Comprehension, Lexis and Structure, Oral Forms), Literature 3. Subtopics do not rescue it: most English questions are tagged only at topic level, and subtopic counts are tiny (Synonyms 4, Antonyms 5). English also has only 264 questions in total. A path here needs the bank re-tagged first, or a different unit (question type) and a larger bank.
3. **Subtopic tagging is too sparse to use anywhere.** Maths has 75 subtopics and none holds 10 questions. The path unit must be the topic, or a grouping of topics, not the subtopic.
4. **Many topics are too thin for a 10-question step.** Under 10 questions: CRK 25 of 46, Government 11 of 33, Maths 10 of 23. A topic with 3 questions cannot give a round, let alone a second-day round of fresh questions.
5. **Even topics with 10 to 29 questions run out.** A 10-question round on day one and another on day two needs about 20 unseen questions. Above 20, the first two stars work without repeats. Between 10 and 19, the second round must repeat some.

## Proposal

- **Path units, kept in data.** A `path_units` table: subject, name, order, and the topics it covers. Thin topics join a neighbour so every unit holds at least 20 questions (for example Maths: Sets, Binary operations, Matrices and Loci into one unit). A row edit changes the path, not a deploy.
- **Unit order from the bank.** The question count per unit stands in for how often JAMB asks it, so "Most asked first" needs no extra data. Syllabus order comes from `topics.sort_order`.
- **Repeat rule.** Serve unseen questions first. When a unit runs out of unseen questions, repeat the oldest-seen ones, with options reshuffled. Stars count recent accuracy, so repeats weigh less than fresh questions.
- **First launch scope.** Build the path for subjects that are ready (Maths, Physics, Chemistry, Accounting, Commerce, Economics, Biology). Hold English, Literature, CRK and Government until their tagging improves, and keep them on practice only. Show them on the path screen as "Coming soon", not as an empty trail.
- **Fix the bank where it is cheapest.** English is the compulsory subject every student takes, so re-tagging English by question type and adding more questions has the highest value.

## Not checked

- Questions with shared passages (English comprehension, Literature) count as single questions here. A 10-question round may need to draw whole passages.
- Duplicate or near-duplicate questions across years.
- How many questions have solutions for the Read page's "Review missed" step.
