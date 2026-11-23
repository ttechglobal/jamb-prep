import type { Block } from "@/lib/content/types";

/**
 * The designed Maths World puzzles. A port of the Flutter app's maths_game_puzzles.dart and maths_topics.dart,
 * so web and mobile teach the same working. Each family teaches one method for one topic and only the numbers
 * vary. The wrong tiles, the wrong rule names and the mistakes are authored with the family: every wrong tile
 * is a slip a real student makes (a sign flipped, the wrong base for a percentage, the operation applied to
 * one side only).
 *
 * Keep this file in step with the Flutter file. tests/maths-world.test.mjs recomputes the arithmetic.
 */

export interface Step {
  title: string;
  lines: string[];
}

/** What the family's author decided about it. */
export interface Design {
  /** The step to leave as the gap, and the wrong lines that go with it. */
  gap: number;
  fillDistractors: string[];
  /** The step whose rule is asked for, and the wrong rules. */
  whyStep: number;
  ruleDistractors: string[];
  /** The step to build from pieces, and two stray pieces. */
  nextStep: number;
  nextExtras: string[];
  /** The slip a student makes, the line it produces, and why it is wrong. */
  mistakeStep: number;
  wrongLine: string;
  explanation: string;
}

export interface Puzzle {
  id: string;
  topic: string;
  stem: Block[];
  steps: Step[];
  design: Design;
}

export interface Topic {
  id: string;
  name: string;
  tagline: string;
  place: string;
}

/** Ordered as a progression: the gentlest first, the most demanding last. */
export const TOPICS: Topic[] = [
  { id: "fractions", name: "Fractions", tagline: "Common denominators, and what is left over.", place: "Fraction Falls" },
  { id: "percent", name: "Percentages, discount and profit", tagline: "Percentage of what? Discount, profit and the right base.", place: "Market Square" },
  { id: "linear", name: "Linear equations", tagline: "Keep the balance: do the same to both sides.", place: "Balance Bridge" },
  { id: "mensuration", name: "Perimeter and area", tagline: "Pick the right formula and substitute carefully.", place: "Shape Studio" },
  { id: "bases", name: "Number bases", tagline: "Binary to base ten and back again.", place: "Binary Beach" },
  { id: "variation", name: "Variation", tagline: "Find the constant k first, then use it.", place: "Constant Canyon" },
  { id: "indices", name: "Indices", tagline: "Equal bases, equal powers. Roots and fractional powers.", place: "Power Peaks" },
  { id: "simultaneous", name: "Simultaneous equations", tagline: "Add or subtract to eliminate a letter, then substitute back.", place: "Twin Rivers" },
  { id: "logs", name: "Logarithms", tagline: "Adding logs multiplies. Switch between log and index form.", place: "Logarithm Lake" },
  { id: "quadratics", name: "Quadratic equations", tagline: "Factorise, set each bracket to zero, and watch the signs.", place: "Quadratic Quarry" },
];
const pow = (b: number, p: number) => b ** p;
const div = (a: number, b: number) => Math.trunc(a / b);

interface Spec {
  topic: string;
  id: string;
  prompt: string;
  promptMath?: string;
  working: [string, string][];
  fillDistractors: string[];
  ruleDistractors: string[];
  nextExtras: string[];
  mistakeStep: number;
  wrongLine: string;
  explanation: string;
  gap?: number;
  whyStep?: number;
  nextStep?: number;
}

function make(s: Spec): Puzzle {
  const middle = s.working.length - 2;
  return {
    id: s.id,
    topic: s.topic,
    stem: [
      { type: "paragraph", content: [{ text: s.prompt }] },
      ...(s.promptMath ? ([{ type: "math", tex: s.promptMath }] as Block[]) : []),
    ],
    steps: s.working.map(([title, tex]) => ({ title, lines: [tex] })),
    design: {
      gap: s.gap ?? middle,
      fillDistractors: s.fillDistractors,
      whyStep: s.whyStep ?? middle,
      ruleDistractors: s.ruleDistractors,
      nextStep: s.nextStep ?? s.working.length - 1,
      nextExtras: s.nextExtras,
      mistakeStep: s.mistakeStep,
      wrongLine: s.wrongLine,
      explanation: s.explanation,
    },
  };
}

// ---- linear equations ----

function equation(a: number, b: number, x: number) {
  const product = a * x;
  const total = product + b;
  return make({
    topic: "linear",
    id: `balance-${a}-${b}-${x}`,
    prompt: `Solve ${a}x + ${b} = ${total} for x.`,
    working: [
      ["Start with the equation", `${a}x+${b}=${total}`],
      [`Subtract ${b} from both sides`, `${a}x=${product}`],
      [`Divide both sides by ${a}`, `x=${x}`],
    ],
    fillDistractors: [`${a}x=${total + b}`, `${a}x=${total}`, `x=${product}`],
    ruleDistractors: [`Add ${b} to both sides`, `Divide both sides by ${a}`, `Subtract ${a} from both sides`],
    nextExtras: ["-", "+"],
    mistakeStep: 1,
    wrongLine: `${a}x=${total + b}`,
    explanation: `Removing +${b} requires subtracting ${b} from both sides. The right side is ${total} − ${b} = ${product}.`,
  });
}

function expand(a: number, b: number, c: number, x: number) {
  const constant = a * b;
  const combined = constant + c;
  const product = a * x;
  const total = product + combined;
  return make({
    topic: "linear",
    id: `expand-${a}-${b}-${c}-${x}`,
    prompt: `Solve ${a}(x + ${b}) + ${c} = ${total} for x.`,
    working: [
      ["Start with the equation", `${a}(x+${b})+${c}=${total}`],
      [`Multiply both terms in the bracket by ${a}`, `${a}x+${constant}+${c}=${total}`],
      ["Combine the constant terms", `${a}x+${combined}=${total}`],
      [`Subtract ${combined} from both sides`, `${a}x=${product}`],
      [`Divide both sides by ${a}`, `x=${x}`],
    ],
    fillDistractors: [`${a}x=${total + combined}`, `${a}x=${total - constant}`, `${a}x=${total - c}`],
    ruleDistractors: [`Add ${combined} to both sides`, `Divide both sides by ${a}`, `Subtract only ${constant} from both sides`],
    nextExtras: ["-", "+"],
    mistakeStep: 1,
    wrongLine: `${a}x+${b}+${c}=${total}`,
    explanation: `The multiplier ${a} applies to x and to ${b}. The constant inside the bracket becomes ${a} × ${b} = ${constant}.`,
  });
}

function bothSides(a: number, c: number, x: number, b: number) {
  const diff = a - c;
  const product = diff * x;
  const d = product + b;
  return make({
    topic: "linear",
    id: `both-sides-${a}-${c}-${x}-${b}`,
    prompt: `Solve ${a}x + ${b} = ${c}x + ${d} for x.`,
    working: [
      ["Start with the equation", `${a}x+${b}=${c}x+${d}`],
      [`Subtract ${c}x from both sides`, `${diff}x+${b}=${d}`],
      [`Subtract ${b} from both sides`, `${diff}x=${product}`],
      [`Divide both sides by ${diff}`, `x=${x}`],
    ],
    gap: 1,
    whyStep: 1,
    nextStep: 2,
    fillDistractors: [`${a + c}x+${b}=${d}`, `${a}x+${b}=${d - c}`, `${diff}x-${b}=${d}`],
    ruleDistractors: [`Add ${c}x to both sides`, `Subtract ${b} from both sides`, `Divide both sides by ${a}`],
    nextExtras: ["-", "+"],
    mistakeStep: 1,
    wrongLine: `${a + c}x+${b}=${d}`,
    explanation: `Take ${c}x from both sides. The left side becomes ${a}x − ${c}x = ${diff}x. Adding the two x terms is the usual slip.`,
  });
}

// ---- simultaneous equations ----

function simultaneous(x: number, y: number) {
  const sum = x + y;
  const diff = x - y;
  return make({
    topic: "simultaneous",
    id: `simultaneous-${x}-${y}`,
    prompt: `Solve the simultaneous equations x + y = ${sum} and x − y = ${diff}.`,
    working: [
      ["Label the two equations", `x+y=${sum}\\quad x-y=${diff}`],
      ["Add the equations to eliminate y", `2x=${sum + diff}`],
      ["Divide both sides by 2", `x=${x}`],
      ["Substitute x into the first equation", `${x}+y=${sum}`],
      [`Subtract ${x} from both sides`, `y=${y}`],
    ],
    gap: 1,
    whyStep: 1,
    nextStep: 3,
    fillDistractors: [`2x=${sum - diff}`, `x=${sum + diff}`, `2x=${sum}`],
    ruleDistractors: ["Subtract the equations to eliminate y", "Add the equations to eliminate x", "Multiply the two equations together"],
    nextExtras: ["-", "x"],
    mistakeStep: 1,
    wrongLine: `2x=${sum - diff}`,
    explanation: `Adding gives x + x = 2x and y − y = 0, so the right side is ${sum} + ${diff} = ${sum + diff}.`,
  });
}

// ---- quadratic equations ----

function quadratic(p: number, q: number) {
  const s = p + q;
  const pr = p * q;
  return make({
    topic: "quadratics",
    id: `quadratic-${p}-${q}`,
    prompt: "Solve by factorising.",
    promptMath: `x^2-${s}x+${pr}=0`,
    working: [
      ["Start with the equation", `x^2-${s}x+${pr}=0`],
      [`Find two numbers that multiply to ${pr} and add to −${s}`, `-${p}\\text{ and }-${q}`],
      ["Write the factors", `(x-${p})(x-${q})=0`],
      ["Set each factor equal to zero", `x-${p}=0\\text{ or }x-${q}=0`],
      ["Solve each equation", `x=${p}\\text{ or }x=${q}`],
    ],
    gap: 2,
    whyStep: 2,
    nextStep: 2,
    fillDistractors: [`(x+${p})(x+${q})=0`, `(x-${p})(x+${q})=0`, `(x-${pr})(x-1)=0`],
    ruleDistractors: ["Expand the brackets", "Divide both sides by x", "Take the square root of both sides"],
    nextExtras: ["+", `${pr}`],
    mistakeStep: 2,
    wrongLine: `(x+${p})(x+${q})=0`,
    explanation: `The numbers are −${p} and −${q}, because they add to −${s}. So the brackets are (x − ${p})(x − ${q}). Plus signs would give +${s}x.`,
  });
}

// ---- indices ----

function indexEquation(b: number, k: number, c: number) {
  const n = pow(b, k);
  return make({
    topic: "indices",
    id: `index-equation-${b}-${k}-${c}`,
    prompt: "Solve for x.",
    promptMath: `${b}^{x+${c}}=${n}`,
    working: [
      ["Start with the equation", `${b}^{x+${c}}=${n}`],
      [`Write ${n} as a power of ${b}`, `${b}^{x+${c}}=${b}^${k}`],
      ["The bases are equal, so equate the powers", `x+${c}=${k}`],
      [`Subtract ${c} from both sides`, `x=${k - c}`],
    ],
    gap: 2,
    whyStep: 2,
    nextStep: 2,
    fillDistractors: [`x+${c}=${n}`, `x-${c}=${k}`, `x=${k + c}`],
    ruleDistractors: ["Multiply the powers together", `Divide ${n} by ${b}`, `Add ${c} to the power`],
    nextExtras: ["-", "\\times"],
    mistakeStep: 1,
    wrongLine: `${b}^{x+${c}}=${b}^${k + 1}`,
    explanation: `${n} = ${b}^${k}, so the power on the right is ${k}, not ${k + 1}.`,
  });
}

function fractionalIndex(r: number, n: number, p: number) {
  const big = pow(r, n);
  const value = pow(r, p);
  const name = n === 2 ? "square" : n === 3 ? "cube" : "fourth";
  const root = n === 2 ? `\\sqrt{${big}}` : `\\sqrt[${n}]{${big}}`;
  return make({
    topic: "indices",
    id: `fractional-index-${r}-${n}-${p}`,
    prompt: "Evaluate the expression without a calculator. Call the answer E.",
    promptMath: `E=${big}^{${p}/${n}}`,
    working: [
      ["Write the expression", `E=${big}^{${p}/${n}}`],
      [`Take the ${name} root, then apply the power ${p}`, `E=(${root})^${p}`],
      [`Work out the ${name} root of ${big}`, `E=${r}^${p}`],
      [`Work out ${r} to the power ${p}`, `E=${value}`],
    ],
    gap: 2,
    whyStep: 1,
    nextStep: 2,
    fillDistractors: [`E=${r}\\times${p}`, `E=${big}^${p}`, `E=${r}^${n}`],
    ruleDistractors: [
      `Take the ${name} root, then multiply by ${p}`,
      `Raise to the power ${n} first, then take the root`,
      `Divide ${big} by ${n}, then raise to the power ${p}`,
    ],
    nextExtras: ["\\times", "+"],
    mistakeStep: 2,
    wrongLine: `E=${r}\\times${p}`,
    explanation: `The ${name} root of ${big} is ${r}. Then raise it to the power ${p}: ${r} to the power ${p} is ${value}, not ${r} × ${p}.`,
  });
}

// ---- logarithms ----

function logSum(a: number, b: number) {
  const n = a * b;
  let k = 0;
  for (let t = n; t > 1; t = div(t, 10)) k++;
  return make({
    topic: "logs",
    id: `log-sum-${a}-${b}`,
    prompt: "Simplify without a calculator (log means log to base 10). Call the answer L.",
    promptMath: `L=\\log ${a}+\\log ${b}`,
    working: [
      ["Write the expression", `L=\\log ${a}+\\log ${b}`],
      ["Use log A + log B = log (A × B)", `L=\\log(${a}\\times${b})`],
      ["Multiply inside the bracket", `L=\\log ${n}`],
      [`Write ${n} as a power of 10`, `L=\\log 10^{${k}}`],
      ["Use log 10ⁿ = n", `L=${k}`],
    ],
    gap: 2,
    whyStep: 1,
    nextStep: 2,
    fillDistractors: [`L=\\log ${a + b}`, `L=${n}`, `L=\\log ${b - a}`],
    ruleDistractors: ["Use log A + log B = log (A + B)", "Use log A + log B = log A × log B", "Use log A − log B = log (A ÷ B)"],
    nextExtras: ["+", "\\div"],
    mistakeStep: 2,
    wrongLine: `L=\\log ${a + b}`,
    explanation: `Adding logs means multiplying the numbers: ${a} × ${b} = ${n}. Adding the numbers is a common slip.`,
  });
}

function logEquation(b: number, k: number) {
  const x = pow(b, k);
  return make({
    topic: "logs",
    id: `log-equation-${b}-${k}`,
    prompt: "Solve for x.",
    promptMath: `\\log_{${b}}x=${k}`,
    working: [
      ["Start with the equation", `\\log_{${b}}x=${k}`],
      ["Change from log form to index form", `x=${b}^${k}`],
      ["Work out the power", `x=${x}`],
    ],
    gap: 1,
    whyStep: 1,
    nextStep: 1,
    fillDistractors: [`x=${b}\\times${k}`, `x=${k}^{${b}}`, `x=${b + k}`],
    ruleDistractors: [`Multiply the base by ${k}`, `Divide ${k} by the base`, `Add the base and ${k}`],
    nextExtras: ["\\times", "+"],
    mistakeStep: 1,
    wrongLine: `x=${k}^{${b}}`,
    explanation: `In log form the base is ${b}, so x = ${b}^${k}. The base stays the base.`,
  });
}

// ---- variation ----

function directVariation(k: number, x1: number, x2: number) {
  const y1 = k * x1;
  const y2 = k * x2;
  return make({
    topic: "variation",
    id: `direct-variation-${k}-${x1}-${x2}`,
    prompt: `y varies directly as x. When x = ${x1}, y = ${y1}. Find y when x = ${x2}.`,
    working: [
      ["Write the variation as an equation", "y=kx"],
      ["Substitute the first values", `${y1}=k\\times${x1}`],
      [`Divide both sides by ${x1} to find k`, `k=${k}`],
      ["Substitute k and the new value of x", `y=${k}\\times${x2}`],
      ["Calculate y", `y=${y2}`],
    ],
    gap: 2,
    whyStep: 2,
    nextStep: 3,
    fillDistractors: [`k=${y1 * x1}`, `k=${y1 + x1}`, `k=${x1}\\div${y1}`],
    ruleDistractors: [`Multiply both sides by ${x1}`, `Subtract ${x1} from both sides`, `Add ${x1} to both sides`],
    nextExtras: ["+", `${x1}`],
    mistakeStep: 2,
    wrongLine: `k=${y1 * x1}`,
    explanation: `k is multiplied by ${x1}, so divide both sides by ${x1}: ${y1} ÷ ${x1} = ${k}.`,
  });
}

function inverseVariation(x1: number, y1: number, x2: number) {
  const k = y1 * x1;
  const y2 = div(k, x2);
  return make({
    topic: "variation",
    id: `inverse-variation-${x1}-${y1}-${x2}`,
    prompt: `y varies inversely as x. When x = ${x1}, y = ${y1}. Find y when x = ${x2}.`,
    working: [
      ["Write the variation as an equation", "y=\\frac{k}{x}"],
      ["Substitute the first values", `${y1}=\\frac{k}{${x1}}`],
      [`Multiply both sides by ${x1} to find k`, `k=${k}`],
      ["Substitute k and the new value of x", `y=\\frac{${k}}{${x2}}`],
      ["Divide", `y=${y2}`],
    ],
    gap: 2,
    whyStep: 2,
    nextStep: 2,
    fillDistractors: [`k=${y1 + x1}`, `k=${y1}\\div${x1}`, `k=${k + x1}`],
    ruleDistractors: [`Divide both sides by ${x1}`, `Subtract ${x1} from both sides`, `Add ${x1} to both sides`],
    nextExtras: ["+", "\\div"],
    mistakeStep: 2,
    wrongLine: `k=${y1}\\div${x1}`,
    explanation: `k is divided by ${x1}, so multiply both sides by ${x1}: ${y1} × ${x1} = ${k}.`,
  });
}

// ---- percentages ----

function percentage(rate: number, base: number) {
  const divisor = div(100, rate);
  const result = div(base, divisor);
  return make({
    topic: "percent",
    id: `percentage-${rate}-${base}`,
    prompt: `Find ${rate}% of ${base}. Call the answer P.`,
    working: [
      ["Write the percentage to find", `P=${rate}\\%\\text{ of }${base}`],
      [`Rewrite ${rate}% as one part out of ${divisor}`, `P=${base}\\div${divisor}`],
      ["Divide to find the percentage", `P=${result}`],
    ],
    fillDistractors: [`P=${base}\\times${divisor}`, `P=${base}+${rate}`, `P=${base}-${divisor}`],
    ruleDistractors: [`Multiply by ${divisor}`, `Subtract ${rate} from ${base}`, `Treat ${rate}% as ${rate} whole units`],
    nextExtras: [`${base}`, "+"],
    mistakeStep: 2,
    wrongLine: `P=${base * divisor}`,
    explanation: `${rate}% is one part out of ${divisor}. Divide ${base} by ${divisor} to get ${result}.`,
  });
}

function discount(rate: number, price: number) {
  const divisor = div(100, rate);
  const saving = div(price, divisor);
  return make({
    topic: "percent",
    id: `discount-${rate}-${price}`,
    prompt: `A bag costs ₦${price} before a ${rate}% discount. Find the sale price S, using D for the discount amount.`,
    working: [
      ["Find the discount amount first", `D=${rate}\\%\\text{ of }${price}`],
      ["Rewrite the percentage as a division", `D=${price}\\div${divisor}`],
      ["Divide to find the discount", `D=${saving}`],
      ["Subtract the discount from the original price", `S=${price}-${saving}=${price - saving}`],
    ],
    fillDistractors: [`D=${price - rate}`, `D=${price + saving}`, `D=${price * divisor}`],
    ruleDistractors: [`Multiply the price by ${divisor}`, "Subtract the discount from the price", "Add the discount to the price"],
    nextExtras: ["+", `${rate}`],
    mistakeStep: 3,
    wrongLine: `S=${price}+${saving}=${price + saving}`,
    explanation: `A discount lowers the price. Subtract ₦${saving} from ₦${price} to get ₦${price - saving}.`,
  });
}

function profit(cost: number, rate: number) {
  const gain = div(cost * rate, 100);
  const sell = cost + gain;
  return make({
    topic: "percent",
    id: `profit-${cost}-${rate}`,
    prompt: `A trader buys a radio for ₦${cost} and sells it for ₦${sell}. Find the percentage profit, R.`,
    working: [
      ["Profit is selling price minus cost price", `P=${sell}-${cost}`],
      ["Calculate the profit", `P=${gain}`],
      ["Write the profit as a fraction of the cost price", `R=\\frac{${gain}}{${cost}}\\times100`],
      ["Calculate the percentage profit", `R=${rate}\\%`],
    ],
    gap: 2,
    whyStep: 2,
    nextStep: 1,
    fillDistractors: [`R=\\frac{${gain}}{${sell}}\\times100`, `R=\\frac{${cost}}{${gain}}\\times100`, `R=${gain}\\times100`],
    ruleDistractors: [
      "Write the profit as a fraction of the selling price",
      "Divide the cost price by the profit",
      "Multiply the profit by the cost price",
    ],
    nextExtras: ["+", "\\times"],
    mistakeStep: 2,
    wrongLine: `R=\\frac{${gain}}{${sell}}\\times100`,
    explanation: `Percentage profit is always worked out on the cost price (₦${cost}), not on the selling price.`,
  });
}

// ---- fractions ----

function fractions(denominator: number, scale: number) {
  const other = div(denominator, scale);
  const numerator = 1 + scale;
  return make({
    topic: "fractions",
    id: `fractions-${denominator}-${scale}`,
    prompt: `Add 1/${denominator} and 1/${other}. Call the sum S.`,
    working: [
      ["Write the sum", `S=\\frac{1}{${denominator}}+\\frac{1}{${other}}`],
      [`Rewrite both fractions with denominator ${denominator}`, `S=\\frac{1}{${denominator}}+\\frac{${scale}}{${denominator}}`],
      ["Add the numerators and keep the denominator", `S=\\frac{${numerator}}{${denominator}}`],
      ["Simplify the fraction", `S=\\frac{1}{${scale}}`],
    ],
    nextStep: 2,
    fillDistractors: [`S=\\frac{${numerator}}{${2 * denominator}}`, `S=\\frac{${scale}}{${denominator}}`, `S=\\frac{${numerator}}{${other}}`],
    ruleDistractors: ["Add both numerators and denominators", "Multiply the numerators", "Keep only the second numerator"],
    nextExtras: [`\\frac{${scale}}{${denominator}}`, "+"],
    mistakeStep: 2,
    wrongLine: `S=\\frac{${numerator}}{${2 * denominator}}`,
    explanation: `The denominators already match. Add 1 and ${scale}, and keep the denominator ${denominator}.`,
  });
}

function fractionLeft(a: number, b: number) {
  const ab = a * b;
  const sum = a + b;
  const left = ab - sum;
  return make({
    topic: "fractions",
    id: `fraction-left-${a}-${b}`,
    prompt: `A man spends 1/${a} of his money on rent and 1/${b} on food. What fraction is left? Call it L.`,
    working: [
      ["Add the fractions spent", `S=\\frac{1}{${a}}+\\frac{1}{${b}}`],
      ["Use a common denominator", `S=\\frac{${b}}{${ab}}+\\frac{${a}}{${ab}}`],
      ["Add the numerators and keep the denominator", `S=\\frac{${sum}}{${ab}}`],
      ["Subtract the amount spent from the whole", "L=1-S"],
      ["Write 1 as a fraction with the same denominator", `L=\\frac{${ab}}{${ab}}-\\frac{${sum}}{${ab}}`],
      ["Subtract the numerators", `L=\\frac{${left}}{${ab}}`],
    ],
    gap: 2,
    whyStep: 1,
    nextStep: 3,
    fillDistractors: [`S=\\frac{2}{${sum}}`, `S=\\frac{1}{${ab}}`, `S=\\frac{${sum}}{${2 * ab}}`],
    ruleDistractors: ["Add the denominators", "Multiply the two fractions", "Cancel the common factor"],
    nextExtras: ["+", "\\times"],
    mistakeStep: 5,
    wrongLine: `L=\\frac{${sum}}{${ab}}`,
    explanation: `The fraction left is 1 − S. Subtract ${sum} from ${ab} to get ${left}, so L = ${left}/${ab}.`,
  });
}

// ---- number bases ----

function fromBaseTen(n: number) {
  const bits = n.toString(2);
  const len = bits.length;
  const power = Array.from({ length: len }, (_, i) => len - 1 - i);
  const digit = Array.from({ length: len }, (_, i) => Number(bits[i]));
  const expanded = digit.map((d, i) => `${d}\\times2^${power[i]}`).join("+");
  const terms = digit.map((d, i) => `${d * pow(2, power[i])}`).join("+");
  const shifted = digit.map((d, i) => `${d * pow(2, power[i] + 1)}`).join("+");
  const allPowers = power.map((q) => pow(2, q)).join("+");
  return make({
    topic: "bases",
    id: `to-base-ten-${n}`,
    prompt: "Convert the binary (base two) number to base ten. Call the answer N.",
    promptMath: `${bits}_{2}`,
    working: [
      ["Write each digit times its place value", `N=${expanded}`],
      ["Work out each term", `N=${terms}`],
      ["Add the terms", `N=${n}`],
    ],
    gap: 1,
    whyStep: 1,
    nextStep: 1,
    fillDistractors: [`N=${shifted}`, `N=${allPowers}`, `N=${digit.join("+")}`],
    ruleDistractors: ["Add the digits together", "Multiply each digit by 10", "Divide each digit by 2"],
    nextExtras: ["\\times", "3"],
    mistakeStep: 1,
    wrongLine: `N=${shifted}`,
    explanation: "The last digit has place value 2^0 = 1, then 2, 4, 8, and so on. Start the powers at 0, not 1.",
  });
}

function toBinary(n: number) {
  const bits = n.toString(2);
  const working: [string, string][] = [];
  for (let q = n; q > 0; q = div(q, 2)) working.push([`Divide ${q} by 2`, `${q}=2\\times${div(q, 2)}+${q % 2}`]);
  const q1 = div(n, 2);
  const q2 = div(q1, 2);
  const r2 = q1 % 2;
  const reversed = bits.split("").reverse().join("");
  working.push(["Read the remainders from the bottom up", `N=${bits}_{2}`]);
  return make({
    topic: "bases",
    id: `to-binary-${n}`,
    prompt: `Convert ${n} to a binary (base two) number. Call the answer N.`,
    working,
    gap: 1,
    whyStep: working.length - 1,
    nextStep: 2,
    fillDistractors: [`${q1}=2\\times${q2 + 1}+${r2}`, `${q1}=2\\times${q2}+${1 - r2}`, `${q1}=3\\times${q2}+${r2}`],
    ruleDistractors: ["Read the remainders from the top down", "Add the remainders together", "Write the quotients in order"],
    nextExtras: ["-", "\\div"],
    mistakeStep: working.length - 1,
    wrongLine: `N=${reversed}_{2}`,
    explanation: `The first remainder is the last digit, so read the remainders from the bottom up: ${bits}.`,
  });
}

// ---- perimeter and area ----

function rectangle(length: number, width: number) {
  const half = length + width;
  const perimeter = 2 * half;
  return make({
    topic: "mensuration",
    id: `rectangle-${length}-${width}`,
    prompt: `A rectangle has perimeter ${perimeter} cm and length ${length} cm. Find its width w in cm.`,
    working: [
      ["Substitute into the perimeter equation", `2(${length}+w)=${perimeter}`],
      ["Divide both sides by 2", `${length}+w=${perimeter}\\div2`],
      ["Find half of the perimeter", `${length}+w=${half}`],
      ["Subtract the length to isolate w", `w=${half}-${length}`],
      ["Calculate the width", `w=${width}`],
    ],
    fillDistractors: [`w=${half}+${length}`, `w=${perimeter}-${length}`, `w=${half}\\div${length}`],
    ruleDistractors: ["Add the length to both sides", "Subtract the length from the full perimeter", "Divide half the perimeter by the length"],
    nextExtras: [`${length}`, "+"],
    mistakeStep: 3,
    wrongLine: `w=${half}+${length}`,
    explanation: `Half the perimeter is length plus width. Subtract the length from ${half} cm to find ${width} cm.`,
  });
}

function trapezium(a: number, b: number, h: number) {
  const sum = a + b;
  const area = div(sum * h, 2);
  return make({
    topic: "mensuration",
    id: `trapezium-${a}-${b}-${h}`,
    prompt: `A trapezium has parallel sides ${a} cm and ${b} cm, and height ${h} cm. Find its area A in cm².`,
    working: [
      ["Write the area formula", "A=(a+b)\\times h\\div2"],
      ["Substitute the values", `A=(${a}+${b})\\times${h}\\div2`],
      ["Add the parallel sides", `A=${sum}\\times${h}\\div2`],
      ["Multiply, then divide by 2", `A=${area}`],
    ],
    gap: 2,
    whyStep: 2,
    nextStep: 2,
    fillDistractors: [`A=${a}\\times${h}\\div2`, `A=${a * b}\\times${h}\\div2`, `A=${sum}\\times${h}`],
    ruleDistractors: ["Multiply the two parallel sides", "Subtract the shorter side from the longer", "Add the height to each parallel side"],
    nextExtras: ["+", "-"],
    mistakeStep: 3,
    wrongLine: `A=${sum * h}`,
    explanation: `Area = (a + b) × h ÷ 2. Do not forget to divide by 2: ${sum} × ${h} ÷ 2 = ${area}.`,
  });
}

export const PUZZLES: Puzzle[] = [
  // Linear equations
  ...([[2, 3, 4], [3, 5, 4], [4, 7, 3], [5, 6, 5], [6, 4, 3], [7, 8, 2], [3, 9, 6], [8, 5, 3], [5, 12, 4], [9, 2, 5]] as const).map(([a, b, x]) => equation(a, b, x)),
  ...([[2, 3, 5, 6], [3, 4, 2, 5], [4, 2, 3, 7], [5, 3, 4, 4], [6, 2, 7, 3], [7, 3, 2, 5], [3, 2, 4, 6], [4, 3, 5, 2], [5, 2, 6, 3], [2, 4, 7, 8]] as const).map(([a, b, c, x]) => expand(a, b, c, x)),
  ...([[5, 2, 4, 3], [7, 3, 2, 5], [6, 2, 3, 4], [8, 5, 4, 2], [9, 4, 2, 7], [7, 2, 3, 6], [6, 1, 4, 5], [9, 5, 3, 2], [8, 3, 2, 9], [5, 3, 6, 4]] as const).map(([a, c, x, b]) => bothSides(a, c, x, b)),
  // Simultaneous equations
  ...([[5, 3], [6, 2], [7, 4], [8, 3], [9, 5], [7, 2], [6, 4], [8, 5], [9, 2], [10, 4]] as const).map(([x, y]) => simultaneous(x, y)),
  // Quadratic equations
  ...([[2, 3], [2, 5], [3, 4], [3, 5], [2, 7], [4, 5], [3, 6], [2, 9], [4, 6], [5, 6]] as const).map(([p, q]) => quadratic(p, q)),
  // Indices
  ...([[2, 5, 1], [3, 4, 1], [2, 6, 3], [5, 3, 1], [3, 5, 2], [2, 7, 3], [4, 3, 1], [6, 3, 1], [5, 4, 2], [2, 8, 3]] as const).map(([b, k, c]) => indexEquation(b, k, c)),
  ...([[10, 3, 2], [3, 3, 2], [4, 3, 2], [5, 3, 2], [2, 4, 3], [3, 4, 3], [2, 2, 3], [3, 2, 3], [5, 2, 3], [6, 3, 2]] as const).map(([r, n, p]) => fractionalIndex(r, n, p)),
  // Logarithms
  ...([[4, 25], [5, 20], [2, 50], [8, 125], [25, 40], [4, 250], [20, 50], [5, 200], [2, 500], [80, 125]] as const).map(([a, b]) => logSum(a, b)),
  ...([[2, 5], [3, 4], [2, 6], [5, 3], [4, 3], [10, 3], [3, 5], [6, 2], [7, 2], [2, 8]] as const).map(([b, k]) => logEquation(b, k)),
  // Variation
  ...([[4, 3, 5], [3, 4, 7], [5, 2, 6], [6, 3, 4], [2, 9, 5], [7, 2, 5], [8, 3, 5], [9, 2, 7], [3, 6, 9], [5, 4, 8]] as const).map(([k, x1, x2]) => directVariation(k, x1, x2)),
  ...([[2, 12, 3], [3, 8, 4], [4, 6, 8], [2, 15, 5], [5, 4, 10], [3, 10, 6], [4, 9, 6], [6, 5, 10], [2, 18, 4], [3, 12, 9]] as const).map(([x1, y1, x2]) => inverseVariation(x1, y1, x2)),
  // Percentages
  ...([[10, 80], [20, 65], [25, 48], [50, 86], [5, 120], [20, 90], [10, 150], [25, 200], [50, 64], [20, 35]] as const).map(([rate, base]) => percentage(rate, base)),
  ...([[10, 900], [20, 650], [25, 480], [50, 780], [5, 1200], [25, 960], [10, 1500], [20, 2500], [50, 640], [25, 2000]] as const).map(([rate, price]) => discount(rate, price)),
  ...([[400, 25], [600, 20], [800, 25], [250, 20], [500, 10], [1200, 5], [900, 10], [350, 20], [150, 40], [240, 25]] as const).map(([cost, rate]) => profit(cost, rate)),
  // Fractions
  ...([[6, 2], [12, 3], [20, 4], [30, 5], [42, 6], [56, 7], [72, 8], [90, 9], [110, 10], [132, 11]] as const).map(([d, s]) => fractions(d, s)),
  ...([[3, 2], [4, 3], [4, 5], [5, 3], [7, 2], [8, 3], [7, 3], [9, 2], [5, 2], [8, 5]] as const).map(([a, b]) => fractionLeft(a, b)),
  // Number bases
  ...[11, 13, 18, 19, 22, 25, 26, 29, 37, 41].map(fromBaseTen),
  ...[11, 13, 18, 19, 22, 25, 26, 29, 37, 41].map(toBinary),
  // Perimeter and area
  ...([[9, 5], [12, 7], [16, 6], [20, 9], [24, 11], [18, 8], [15, 4], [21, 10], [14, 13], [30, 12]] as const).map(([l, w]) => rectangle(l, w)),
  ...([[7, 5, 4], [9, 3, 5], [10, 6, 4], [12, 8, 5], [11, 7, 6], [13, 5, 4], [14, 6, 3], [15, 9, 5], [8, 4, 9], [16, 10, 3]] as const).map(([a, b, h]) => trapezium(a, b, h)),
];
