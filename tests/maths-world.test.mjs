// Recomputes the designed Maths World puzzles, so no wrong answer can ship. Run: node --test tests/maths-world.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { PUZZLES, TOPICS } from "../lib/games/maths/families.ts";

const ids = (p) => p.id.split("-").map(Number).filter((n) => !Number.isNaN(n));
const last = (p) => p.steps.at(-1).lines[0];
const byPrefix = (prefix) => PUZZLES.filter((p) => p.id.startsWith(prefix));

test("every topic has puzzles and every puzzle has a known topic", () => {
  for (const t of TOPICS) assert.ok(PUZZLES.some((p) => p.topic === t.id), `${t.id} has no puzzles`);
  for (const p of PUZZLES) assert.ok(TOPICS.some((t) => t.id === p.topic), `${p.id} has an unknown topic`);
  assert.equal(new Set(PUZZLES.map((p) => p.id)).size, PUZZLES.length, "puzzle ids are unique");
});

test("the author's choices point at real steps and real wrong answers", () => {
  for (const p of PUZZLES) {
    const d = p.design;
    const n = p.steps.length;
    assert.ok(n >= 3, `${p.id} is too short`);
    for (const i of [d.gap, d.whyStep, d.nextStep, d.mistakeStep]) assert.ok(i >= 1 && i < n, `${p.id} has a design index out of range`);
    for (const w of d.fillDistractors) assert.notEqual(w, p.steps[d.gap].lines[0], `${p.id}: a wrong tile equals the right line`);
    assert.notEqual(d.wrongLine, p.steps[d.mistakeStep].lines[0], `${p.id}: the wrong line equals the right line`);
    assert.equal(new Set(d.fillDistractors).size, d.fillDistractors.length, `${p.id}: repeated wrong tiles`);
  }
});

test("linear equations give the stated x", () => {
  for (const p of byPrefix("balance-")) {
    const [a, b, x] = ids(p);
    assert.equal(last(p), `x=${x}`);
    assert.match(p.stem[0].content[0].text, new RegExp(`${a}x \\+ ${b} = ${a * x + b}`));
  }
  for (const p of byPrefix("expand-")) {
    const [a, b, c, x] = ids(p);
    assert.match(p.stem[0].content[0].text, new RegExp(`${a}\\(x \\+ ${b}\\) \\+ ${c} = ${a * (x + b) + c}`));
    assert.equal(last(p), `x=${x}`);
  }
  for (const p of byPrefix("both-sides-")) {
    const [a, c, x, b] = ids(p);
    assert.match(p.stem[0].content[0].text, new RegExp(`${a}x \\+ ${b} = ${c}x \\+ ${(a - c) * x + b}`));
    assert.equal(last(p), `x=${x}`);
  }
});

test("simultaneous, quadratic, index and log answers", () => {
  for (const p of byPrefix("simultaneous-")) {
    const [x, y] = ids(p);
    assert.equal(p.steps[2].lines[0], `x=${x}`);
    assert.equal(last(p), `y=${y}`);
  }
  for (const p of byPrefix("quadratic-")) {
    const [a, b] = ids(p);
    assert.equal(last(p), `x=${a}\\text{ or }x=${b}`);
    assert.equal(p.stem[1].tex, `x^2-${a + b}x+${a * b}=0`);
  }
  for (const p of byPrefix("index-equation-")) {
    const [b, k, c] = ids(p);
    assert.equal(p.stem[1].tex, `${b}^{x+${c}}=${b ** k}`);
    assert.equal(last(p), `x=${k - c}`);
  }
  for (const p of byPrefix("log-equation-")) {
    const [b, k] = ids(p);
    assert.equal(last(p), `x=${b ** k}`);
  }
  for (const p of byPrefix("log-sum-")) {
    const [a, b] = ids(p);
    assert.equal(last(p), `L=${Math.round(Math.log10(a * b))}`);
    assert.equal(10 ** Math.round(Math.log10(a * b)), a * b, `${p.id}: the product is not a power of 10`);
  }
});

test("variation, percentages, fractions, bases and mensuration", () => {
  for (const p of byPrefix("direct-variation-")) {
    const [k, , x2] = ids(p);
    assert.equal(last(p), `y=${k * x2}`);
  }
  for (const p of byPrefix("inverse-variation-")) {
    const [x1, y1, x2] = ids(p);
    assert.equal((x1 * y1) % x2, 0, `${p.id}: y is not whole`);
    assert.equal(last(p), `y=${(x1 * y1) / x2}`);
  }
  for (const p of byPrefix("percentage-")) {
    const [rate, base] = ids(p);
    assert.equal((base * rate) % 100, 0);
    assert.equal(last(p), `P=${(base * rate) / 100}`);
  }
  for (const p of byPrefix("discount-")) {
    const [rate, price] = ids(p);
    assert.equal((price * rate) % 100, 0);
    assert.match(last(p), new RegExp(`=${price - (price * rate) / 100}$`));
  }
  for (const p of byPrefix("profit-")) {
    const [cost, rate] = ids(p);
    assert.equal((cost * rate) % 100, 0);
    assert.equal(last(p), `R=${rate}\\%`);
  }
  for (const p of byPrefix("fractions-")) {
    const [den, scale] = ids(p);
    assert.equal(den % scale, 0);
    assert.equal(last(p), `S=\\frac{1}{${scale}}`);
    assert.equal((1 + scale) / den, 1 / scale, `${p.id}: the sum does not simplify to 1/${scale}`);
  }
  for (const p of byPrefix("fraction-left-")) {
    const [a, b] = ids(p);
    assert.equal(last(p), `L=\\frac{${a * b - a - b}}{${a * b}}`);
  }
  for (const p of byPrefix("to-base-ten-")) {
    const [n] = ids(p);
    assert.equal(last(p), `N=${n}`);
    assert.equal(p.stem[1].tex, `${n.toString(2)}_{2}`);
  }
  for (const p of byPrefix("to-binary-")) {
    const [n] = ids(p);
    assert.equal(last(p), `N=${n.toString(2)}_{2}`);
  }
  for (const p of byPrefix("rectangle-")) {
    const [l, w] = ids(p);
    assert.equal(last(p), `w=${w}`);
    assert.match(p.stem[0].content[0].text, new RegExp(`perimeter ${2 * (l + w)} cm`));
  }
  for (const p of byPrefix("trapezium-")) {
    const [a, b, h] = ids(p);
    assert.equal(((a + b) * h) % 2, 0);
    assert.equal(last(p), `A=${((a + b) * h) / 2}`);
  }
});

test("typed final answers are accepted in the ways a student writes them", async () => {
  const { checkAnswer } = await import("../lib/games/maths/answer.ts");
  assert.ok(checkAnswer("4", "x=4"));
  assert.ok(checkAnswer("x = 4", "x=4"));
  assert.ok(checkAnswer("2 and 3", "x=2\\text{ or }x=3"));
  assert.ok(checkAnswer("3, 2", "x=2\\text{ or }x=3"));
  assert.ok(!checkAnswer("2", "x=2\\text{ or }x=3"));
  assert.ok(checkAnswer("1/2", "S=\\frac{1}{6}") === false);
  assert.ok(checkAnswer("1/2", "S=\\frac{1}{2}"));
  assert.ok(checkAnswer("2/4", "S=\\frac{1}{2}"));
  assert.ok(checkAnswer("25%", "R=25\\%"));
  assert.ok(checkAnswer("25", "R=25\\%"));
  assert.ok(checkAnswer("1011", "N=1011_{2}"));
  assert.ok(checkAnswer("1011_2", "N=1011_{2}"));
  assert.ok(checkAnswer("₦810", "S=900-90=810"));
  assert.ok(checkAnswer("1,200", "S=1200"));
  assert.ok(checkAnswer("36 cm", "A=36"));
  assert.ok(!checkAnswer("", "x=4"));
  assert.ok(!checkAnswer("5", "x=4"));
});

test("every puzzle's own final line is accepted as its answer", async () => {
  const { checkAnswer } = await import("../lib/games/maths/answer.ts");
  for (const p of PUZZLES) assert.ok(checkAnswer(last(p), last(p)), `${p.id}: ${last(p)}`);
});


test("every level can be made from every puzzle that suits it", async () => {
  const { MATHS_LEVELS, makeItem } = await import("../lib/games/maths/engine.ts");
  for (const level of MATHS_LEVELS) {
    let made = 0;
    for (const p of PUZZLES) {
      for (let t = 0; t < 4; t++) {
        const item = makeItem(p, level);
        if (!item) continue;
        made++;
        for (const g of item.gaps) {
          if (g.mode === "pick") {
            assert.ok(g.options.length >= 3, `${p.id}/${level.id}: too few tiles`);
            assert.equal(g.options.filter((o) => o.join("\n") === g.answer.join("\n")).length, 1, `${p.id}/${level.id}: the right tile must appear exactly once`);
            assert.equal(new Set(g.options.map((o) => o.length)).size, 1, `${p.id}/${level.id}: tiles differ in size`);
          }
          if (g.mode === "order") {
            assert.equal([...g.shuffled].sort((a, b) => a - b).join(), p.steps.map((_, i) => i).join());
            assert.ok(g.shuffled.some((v, i) => v !== i), `${p.id}: order is already right`);
          }
          if (g.mode === "why") {
            assert.ok(g.whyOptions.includes(p.steps[g.step].title));
            assert.ok(g.whyOptions.length >= 3 && g.step >= 1);
            assert.equal(new Set(g.whyOptions).size, g.whyOptions.length);
          }
          if (g.mode === "spot") {
            if (g.spot.mistake === null) assert.deepEqual(g.spot.shown, p.steps);
            else assert.notEqual(g.spot.shown[g.spot.mistake].lines[0], p.steps[g.spot.mistake].lines[0], `${p.id}: the altered line equals the right one`);
          }
        }
      }
    }
    assert.ok(made > 0, `${level.id} made nothing`);
  }
});

test("a topic can fill every level of its ladder", async () => {
  const { MATHS_LEVELS, TOPICS, drawItems } = await import("../lib/games/maths/engine.ts");
  for (const t of TOPICS) for (const l of MATHS_LEVELS) assert.equal(drawItems(t.id, l.id).length, 5, `${t.id}/${l.id} has fewer than five questions`);
});

test("stars: three of five earns the first star", async () => {
  const { mathsStars, rightForFirstStar, masteryOf, MATHS_LEVELS } = await import("../lib/games/maths/engine.ts");
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((r) => mathsStars(r, 5)), [0, 0, 0, 1, 2, 3]);
  assert.equal(rightForFirstStar(5), 3);
  assert.equal(mathsStars(6, 10), 1);
  assert.equal(mathsStars(0, 0), 0);
  const all = Object.fromEntries(MATHS_LEVELS.map((l) => [l.id, 3]));
  assert.equal(masteryOf({}).label, "Not started");
  assert.equal(masteryOf({ "pick-one": 1 }).label, "Still coming up");
  assert.equal(masteryOf(all).label, "Expert");
  assert.notEqual(masteryOf({ ...all, solve: 0 }).label, "Expert");
});

test("topics run from gentle to demanding", async () => {
  const { TOPICS } = await import("../lib/games/maths/engine.ts");
  const ids = TOPICS.map((t) => t.id);
  assert.equal(ids[0], "fractions");
  assert.ok(ids.indexOf("fractions") < ids.indexOf("indices"));
  assert.ok(ids.indexOf("indices") < ids.indexOf("simultaneous"));
  assert.equal(ids.at(-1), "quadratics");
});
