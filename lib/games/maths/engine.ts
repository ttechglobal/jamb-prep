import { PUZZLES, TOPICS, type Puzzle, type Step, type Topic } from "./families";

export { PUZZLES, TOPICS };
export type { Puzzle, Step, Topic };

/**
 * Maths World: "finish the working". A worked solution is shown line by line and stops at a gap. Nothing after
 * the gap is shown until the student has answered it, right or wrong. Then the working carries on from the
 * correct line, to the next gap or to the end.
 *
 * The puzzles are designed, not taken from the question bank (see families.ts). Each family's author chose the
 * gap and wrote the wrong tiles, so a wrong tile is always a slip a real student makes. Where a level asks for
 * a gap the author did not design, wrong tiles are made by flipping a sign or changing a number.
 */

export const topicById = (id: string) => TOPICS.find((t) => t.id === id);
export const puzzlesFor = (topicId: string) => PUZZLES.filter((p) => p.topic === topicId);

// ---- the ladder ----

export interface MathsLevel {
  id: string;
  title: string;
  blurb: string;
  /** What the student does at each gap. */
  mode: "pick" | "build" | "answer";
  /** How many gaps. "all" leaves every line after the first as a gap (up to four). */
  gaps: 1 | 2 | "all";
  /** Whether the heading of a gapped line is shown while the student answers. */
  showHeading: boolean;
  lesson: string;
}

export const MATHS_LEVELS: MathsLevel[] = [
  {
    id: "pick-one",
    title: "Finish the line",
    blurb: "The working stops at one gap. Pick the line that belongs.",
    mode: "pick",
    gaps: 1,
    showHeading: true,
    lesson: "Read the heading and the line above the gap. Ask what was done to get the next line.",
  },
  {
    id: "pick-two",
    title: "Keep going",
    blurb: "The working stops twice. The second gap depends on the first.",
    mode: "pick",
    gaps: 2,
    showHeading: true,
    lesson: "Settle the first gap, then use the correct line to work out the next one.",
  },
  {
    id: "build",
    title: "Build the line",
    blurb: "No tiles to choose from. Build the line piece by piece.",
    mode: "build",
    gaps: 1,
    showHeading: true,
    lesson: "Do the step in your head first, then pick the pieces. Watch your signs.",
  },
  {
    id: "no-hints",
    title: "No hints",
    blurb: "Every line is a gap and the headings are hidden until you answer.",
    mode: "build",
    gaps: "all",
    showHeading: false,
    lesson: "Decide the move yourself. The heading appears only after you have answered.",
  },
  {
    id: "solve",
    title: "Solve it",
    blurb: "Only the question. Work it out and type the final answer.",
    mode: "answer",
    gaps: 1,
    showHeading: false,
    lesson: "Use paper if you need it. Write fractions like 1/2, and if there are two answers, write both.",
  },
];

export const ITEMS_PER_PLAY = 5;

export const levelById = (id: string) => MATHS_LEVELS.find((l) => l.id === id);

// ---- pieces ----

// A command such as \times (one piece), a whole simple fraction, a number, a letter, or any other symbol.
const TOKEN = /\\frac\{[0-9a-zA-Z]+\}\{[0-9a-zA-Z]+\}|\\[a-zA-Z]+|\\.|[0-9]+(?:\.[0-9]+)?|[a-zA-Z]|\S/g;
const WHOLE_FRACTION = /\\frac\{[0-9a-zA-Z]+\}\{[0-9a-zA-Z]+\}/g;

export const tokenize = (tex: string): string[] => tex.match(TOKEN) ?? [];

/** Braces (roots, powers such as x^{2}) are awkward to build from tiles, so those lines are picked instead. */
export function buildable(tex: string) {
  const rest = tex.replace(WHOLE_FRACTION, "");
  return !rest.includes("{") && !rest.includes("}") && tokenize(tex).length <= 14;
}

const norm = (tex: string) => tokenize(tex).join(" ");
const key = (lines: string[]) => lines.map(norm).join("\n");

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wrong versions of a line: a sign flipped, or a number changed by one or two. Never the original. */
export function perturb(tex: string): string[] {
  const out = new Set<string>();
  const ms = [...tex.matchAll(TOKEN)];
  const swap = (i: number, to: string) => {
    const m = ms[i];
    const w = tex.slice(0, m.index) + to + tex.slice((m.index ?? 0) + m[0].length);
    if (norm(w) !== norm(tex)) out.add(w);
  };
  ms.forEach((m, i) => {
    const t = m[0];
    if (t === "+") swap(i, "-");
    if (t === "-") swap(i, "+");
    const v = Number(t);
    if (/^[0-9]+$/.test(t) && v < 1000) for (const d of [1, -1, 2]) if (v + d >= 0) swap(i, String(v + d));
  });
  return shuffle([...out]);
}

// ---- items ----

export interface Gap {
  /** Index of the step left empty. */
  step: number;
  mode: "pick" | "build" | "answer";
  /** The correct lines of the step. */
  answer: string[];
  /** Why the author's slip is wrong, shown when the student makes a mistake on the step it was written for. */
  explain: string | null;
  /** pick: the choices, each a step's lines. */
  options: string[][];
  /** build: the pieces to use, the right ones and two strays. */
  pieces: string[];
}

export interface Item {
  puzzle: Puzzle;
  gaps: Gap[];
  showHeading: boolean;
}

function pickOptions(p: Puzzle, step: number): string[][] | null {
  const right = p.steps[step].lines;
  const seen = new Set([key(right)]);
  const wrong: string[][] = [];
  const add = (lines: string[]) => {
    if (wrong.length < 3 && !seen.has(key(lines))) {
      seen.add(key(lines));
      wrong.push(lines);
    }
  };
  // The author's own wrong tiles come first: they are the mistakes students really make.
  if (step === p.design.gap) for (const w of p.design.fillDistractors) add([w]);
  // Then slips on the right line, then other lines of the same working and the same shape, so the size of a
  // tile never gives the answer away.
  const slips = right.map((_, i) => perturb(right[i]).slice(0, 2).map((w) => right.map((l, k) => (k === i ? w : l))));
  for (const sl of slips.flat()) add(sl);
  for (const sl of shuffle(p.steps.map((x) => x.lines).filter((l) => l.length === right.length))) add(sl);
  if (wrong.length < 2) return null;
  return shuffle([right, ...wrong]);
}

function buildPieces(p: Puzzle, step: number): string[] {
  const tex = p.steps[step].lines[0];
  const answer = tokenize(tex);
  const authored = step === p.design.nextStep ? p.design.nextExtras.filter((t) => !answer.includes(t)) : [];
  const spare = [...new Set(["+", "-", "2", "x", "3", "="])].filter((t) => !answer.includes(t) && !authored.includes(t));
  const strays = [...authored, ...shuffle(spare)].slice(0, 2);
  return shuffle([...answer, ...strays]);
}

function gapFor(p: Puzzle, step: number, wantBuild: boolean): Gap | null {
  const lines = p.steps[step].lines;
  const explain = step === p.design.mistakeStep ? p.design.explanation : null;
  if (wantBuild && lines.length === 1 && buildable(lines[0])) {
    return { step, mode: "build", answer: lines, explain, options: [], pieces: buildPieces(p, step) };
  }
  const options = pickOptions(p, step);
  return options ? { step, mode: "pick", answer: lines, explain, options, pieces: [] } : null;
}

function chooseStops(p: Puzzle, level: MathsLevel): number[] {
  const n = p.steps.length;
  // The first step restates the question, so gaps start from the second.
  const all = Array.from({ length: n - 1 }, (_, i) => i + 1);
  if (level.gaps === "all") return all.slice(-4);
  const d = p.design;
  // One gap: the one the author designed (or, to build, the line the author chose to build).
  const first = level.mode === "build" && buildable(p.steps[d.nextStep].lines[0]) ? d.nextStep : d.gap;
  if (level.gaps === 1) return [first];
  // Two gaps: the designed one, and a later (or earlier) line, not side by side where there is room.
  const others = all.filter((i) => i !== first);
  const apart = others.filter((i) => Math.abs(i - first) > 1);
  const pool = apart.length ? apart : others;
  const second = pool[pool.length - 1];
  return [first, second].sort((x, y) => x - y);
}

export function makeItem(p: Puzzle, level: MathsLevel): Item | null {
  if (level.mode === "answer") {
    // Only the question is shown. The last line of the working is the answer.
    const step = p.steps.length - 1;
    const gap: Gap = { step, mode: "answer", answer: p.steps[step].lines, explain: null, options: [], pieces: [] };
    return { puzzle: p, gaps: [gap], showHeading: false };
  }
  const steps = chooseStops(p, level);
  const gaps: Gap[] = [];
  for (const s of steps) {
    const g = gapFor(p, s, level.mode === "build");
    if (!g) return null;
    gaps.push(g);
  }
  return { puzzle: p, gaps, showHeading: level.showHeading };
}

/** The puzzles for one play, short working first so a play eases in. */
export function drawItems(topicId: string, levelId: string, n = ITEMS_PER_PLAY): Item[] {
  const level = levelById(levelId);
  if (!level) return [];
  const pool = shuffle(puzzlesFor(topicId));
  const out: Item[] = [];
  for (const p of pool) {
    if (out.length >= n) break;
    const item = makeItem(p, level);
    if (item) out.push(item);
  }
  return out.sort((a, b) => a.puzzle.steps.length - b.puzzle.steps.length);
}

export const sameLines = (a: string[], b: string[]) => key(a) === key(b);
export const sameBuild = (pieces: string[], tex: string) => pieces.join(" ") === tokenize(tex).join(" ");

export { checkAnswer } from "./answer";

// ---- how well a student knows a topic ----

export const STARS_PER_TOPIC = MATHS_LEVELS.length * 3;

export interface Mastery {
  stars: number;
  max: number;
  label: string;
  /** 0 to 4, for colour. */
  rank: 0 | 1 | 2 | 3 | 4;
}

export function masteryOf(stars: Record<string, number>): Mastery {
  const total = MATHS_LEVELS.reduce((sum, l) => sum + Math.min(3, stars[l.id] ?? 0), 0);
  // Expert needs the last level at three stars as well: the student can do the whole question alone.
  const solved = (stars.solve ?? 0) >= 3;
  if (total === 0) return { stars: total, max: STARS_PER_TOPIC, label: "Not started", rank: 0 };
  if (total >= STARS_PER_TOPIC - 1 && solved) return { stars: total, max: STARS_PER_TOPIC, label: "Expert", rank: 4 };
  if (total >= 10) return { stars: total, max: STARS_PER_TOPIC, label: "Strong", rank: 3 };
  if (total >= 5) return { stars: total, max: STARS_PER_TOPIC, label: "Getting there", rank: 2 };
  return { stars: total, max: STARS_PER_TOPIC, label: "Still coming up", rank: 1 };
}