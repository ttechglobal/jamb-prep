# Maths World: finish the working

Games are split into two worlds: **English World** (`/games/english`) and **Maths World** (`/games/maths`).

## The idea

A worked solution is shown line by line. It **stops at a gap**, and nothing after the gap is shown until the student has answered it, right or wrong. The working then carries on from the *correct* line, to the next gap or to the end. The student thinks at the exact step where marks are lost, not just recognising an answer.

- No retry. A wrong answer shows the correct line, what the student chose, and (where the author wrote one) why that slip is wrong. The working continues, so a mistake never leaves the student stranded.
- Stars come from gaps filled correctly (same thresholds as the English quizzes).

## Content: designed, not taken from the question bank

The puzzles are the designed ones from the Flutter app's Maths World (`maths_game_puzzles.dart`, `maths_topics.dart`), ported to `lib/games/maths/families.ts`. 22 families, 10 variants each, 220 puzzles, across 10 topics. Each family teaches one method and only the numbers vary. The author chose the gap and wrote the wrong tiles, the wrong rule names and the typical mistake with its explanation, so a wrong tile is always a slip a real student makes.

The real solutions in the question bank are **not** used for these games (decided earlier by the owner). Keep `families.ts` in step with the Flutter file. `tests/maths-world.test.mjs` recomputes every generated answer.

## Ladder (per topic) and mastery

Games are organised by topic, not by challenge style. A student picks a topic and climbs five levels. Each is harder than the one before, and the last asks for the whole question.

| Level | What the student does | Heading while answering |
|---|---|---|
| 1. Finish the line | picks one missing line (the author's wrong tiles) | shown |
| 2. Keep going | picks two missing lines; the second depends on the first | shown |
| 3. Build the line | builds the missing line from pieces (picks if the line has roots or text) | shown |
| 4. No hints | builds every line after the first (up to 4) | hidden until answered |
| 5. Solve it | sees only the question and types the final answer; the full working appears afterwards | none |

A level opens when the one before has a star. Each level gives up to 3 stars (15 per topic). The topic shows a mastery label from its stars: **Not started**, **Still coming up** (1 to 4), **Getting there** (5 to 9), **Strong** (10 or more), **Expert** (14 or more with three stars on Solve it). Progress is saved per topic as game id `maths-<topic>` through the existing `save_game_progress`.

Typed answers (`lib/games/maths/answer.ts`) are forgiving: any order for two answers ("2 and 3"), with or without the letter, the unit, ₦, % or the base, and fractions as 1/2 (2/4 is accepted too).
## Not done yet

- Gaps the author did not design (second gap, No hints) use mechanical wrong tiles: a sign flipped or a number changed. Authoring wrong tiles for every step would sharpen them.
- The Flutter ladder also has "Put in order", "Name the step" and "Spot the mistake". The authored data for them is ported but unused here. They would make good extra levels.
- Other subjects (the Flutter app plans Physics, Chemistry, Biology and others) are not in the web app.
