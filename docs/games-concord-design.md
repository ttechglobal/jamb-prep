# Games — Design Notes (agreed in brainstorm)

Status: first version BUILT (12 levels + Mixed), not yet reviewed by the owner on a real phone, nothing committed.
- Content: lib/games/concord/levels.ts (plain sentences with a ___ gap; add a level = add data)
- Player: components/games/concord-player.tsx (drag or tap; reveal + reason on a wrong answer, no retry)
- Routes: /games (hub), /games/concord (level map), /games/concord/[level] (play); linked from Practice and the header
- A level = 3 rounds x 5 sentences, drawn fresh from a pool of 17-20. Stars: 3 at 14/15, 2 at 12/15, 1 at 10/15. One star unlocks the next level; Mixed unlocks after levels 1-3.
- Progress is saved in localStorage only for now (lib/games/concord/progress.ts). No XP yet, no database table yet.
Order of work: agree content -> write content -> build. User side ships before admin side.

## Principles
- It is called a game. Do not build several game formats to cover one subject. One simple game with many levels (Concord), and a different game only for a different kind of thing (e.g. Sounds).
- Every level is focused on ONE narrow thing (e.g. has/have). Play a few rounds, clear it, move up. The ladder is open-ended and can keep growing beyond the draft list.
- Simple at the start, progressive, and there is always something to play when a student returns.
- Practises concepts students struggle with / that are heavily tested. Not actual exam questions.
- Different games for different areas; same shell, different content.

## Game 1: Concord (subject-verb agreement), English
**Mechanic:** a sentence with a gap, 2-3 word tiles below. Student drags the right tile into the gap. Tap-to-place as fallback for weak phones.

**Wrong answer:** NO retry. Reveal the correct answer with a one-line reason, then move on. It's a game; to try again, replay the level.

**Progression:** levels, each = one rule, ~8 sentences (~1 min). 1-3 stars by accuracy. One star unlocks the next level. After the ladder, an endless Mixed mode with a best score.

**Theme of levels:** each level answers a question students actually get confused by ("when do I use has vs have?", "is 'news' singular?"). Because the confusions are many, the ladder can keep growing.

Draft ladder (to be agreed before writing content):
1. is / are
2. has / have, does / do
3. verbs with -s (plays / play)
4. phrase between subject and verb
5. collective nouns
6. singular words that look plural (news, mathematics, series)
7. each / every / everyone / nobody
8. either/or, neither/nor
9. "one of the...", "the number of" vs "a number of"
10. past tense was/were + mixed traps
Then: Mixed mode (endless, gets harder, best score).

**Replayability:** sentences assembled from parts (subjects x verbs x phrases), so each replay of a level is fresh.

**First build scope:** levels 1-6, Mixed unlocked after, stars saved per level, "why" line on mistakes. Lives under English in Learn.

## Game 2 (later): Sounds, Oral English
"Identify the sound in this word." Separate game, same shell. Brainstorm after Concord is tested.

## Open
- Final level list and the exact confusion each level targets.
- Sentence parts / content format (data, so admin can add later).
