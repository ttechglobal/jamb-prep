# Question bank audit

7 Nov 2026. Read-only audit of the Exam Prep A1 export. Nothing has been uploaded.

Export: `jamb_questions.jsonl`, 6,072 rows, exported 2026-11-07T07:46Z. Checksums match its manifest.
Row-level results are in `data/imports/audit/` (gitignored, because they contain answer keys).

## Result

| | Rows |
|---|---:|
| Exported | 6,072 |
| Exact duplicates removed | 401 |
| Held back for review | 425 |
| In both groups | 32 |
| **Ready to import after the mechanical fixes** | **5,278** |

| Subject | Ready | Held | Topic tags in the export |
|---|---:|---:|---:|
| Physics | 836 | 60 | 78% |
| Accounting | 637 | 42 | 79% |
| Chemistry | 627 | 39 | 81% |
| Government | 533 | 25 | 75% |
| Mathematics | 501 | 122 | 0% |
| Economics | 491 | 10 | 83% |
| CRK | 467 | 8 | 59% |
| Commerce | 447 | 21 | 0% |
| Biology | 420 | 18 | 71% |
| English Language | 184 | 18 | 33% |
| Literature in English | 135 | 62 | 96% |

## Passed

- All 6,072 lines parse, and every ID is unique.
- All rows are JAMB, active and unflagged. The rows that were meant to be excluded are absent.
- Every question has options A to D with text, and a valid answer key.
- Every topic and subtopic link resolves and belongs to the right subject.
- 13,888 formula fragments in explanations rendered, except 1. One more row uses `$` as currency.
- No HTML, broken encoding or placeholder text in questions or options.
- The 4 SVG illustrations contain no scripts or links.

## Why rows are held

A row can have more than one reason.

| Reason | Rows |
|---|---:|
| The explanation admits a problem: no option fits, best guess, typo, data missing | 293 |
| Literature quote credited to a real author and not verified | 62 |
| Explanation contradicts the answer key or belongs to another question | 38 |
| Duplicate copies disagree on the answer | 10 |
| Two options are identical | 10 |
| Needs a diagram, document or table that is missing | 6 |
| Answer key contradicts the working, and the correct key is clear | 4 |
| Same pair listed twice in reversed order | 4 |
| Duplicate of a held row | 4 |
| Corrupted wording ("20cm floppy") | 2 |
| Chemical name error (tetraoxosulphate(IV) acid) | 2 |
| Wrong answer found by hand (88c0ddd6, keyed as Parasitism) | 1 |
| Placeholder explanation ("x") | 1 |

## Risks the checks cannot remove

- **Answer keys are not proven correct.** A hand review of 77 random rows that passed every check found 1 wrong key. The sample is too small to give a reliable rate. Explanations were written to follow the key, so they are not independent proof.
- **Correct answers lean towards certain letters.** Literature is 70% A, Mathematics 56% A, Economics 53% B and CRK 51% B. That pattern lets a student score well by guessing one letter.
- **Year labels are unreliable.** In 239 of 387 duplicate groups, the same question appears twice under the same year. Do not present these as genuine papers for a named year.
- **Literature does not look like JAMB content.** The 135 ready rows are mostly short unattributed lines asking for a literary device. I did not check all 135 individually.

## Mechanical fixes for the import

| Fix | Rows |
|---|---:|
| Convert `x^2` style notation to formulas | 436 |
| Remove the instruction repeated at the start of the stem | 181 |
| Use one naira symbol (`N` 311 rows, `#` 21 rows, `₦` 162 rows) | About 330 |
| Remove letters repeated inside option text ("C. a decrease") | 40 |
| Convert flat chemical formulas (KMnO4) | About 51 |
| Rebuild tables stored as text | About 9 |

Also needed:

- Tighten `validateQuestion`. On this data it raised 146 alerts, nearly all false, and missed real cases such as "The above document represents a".
- Decide whether to reshuffle option letters. 113 explanations mention a letter in their prose and need rewording, and 36 rows have options that must stay last.

## Import result

Loaded on 7 Nov 2026 with `npm run db:import -- --apply`. Check it any time with `npm run db:check`.

| | Rows |
|---|---:|
| Published | 5,276 |
| Left out, stored in `question_import_rows` with reasons | 796 |
| Total | 6,072 |

- Two more rows failed conversion and were left out: `9ee27501` (the explanation hedges on the answer) and `bb921c26` (`$` used as currency in the explanation).
- Options were reshuffled on 5,030 rows. The rest stayed in place because an option or explanation refers to a letter.
- The 4 rows with a clearly wrong key were left out, not corrected. They can be repaired from `question_import_rows`.
- Literature is stored with source `practice`, not `past_paper`.
