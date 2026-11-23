/** Checks a typed final answer. Kept free of imports so it can be tested on its own. */

const fractionToSlash = (t: string) => t.replace(/\\frac\{([0-9a-zA-Z]+)\}\{([0-9a-zA-Z]+)\}/g, "$1/$2");

/** The values a final line stands for: "x=2\text{ or }x=3" is [2, 3], "S=\frac{1}{2}" is [1/2], "N=1011_{2}" is [1011]. */
function answerParts(raw: string): string[] {
  return fractionToSlash(raw)
    .replace(/\\text\{\s*(or|and)\s*\}/g, " ")
    .replace(/\\%|%|₦|\\quad|\\,/g, "")
    .replace(/_\{?2\}?/g, "")
    .replace(/cm²|cm2|\bcm\b|\bnaira\b/gi, "")
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(/\b(and|or)\b|[,;]/gi, " ")
    .toLowerCase()
    .replace(/\s*=\s*/g, "=")
    .trim()
    .split(/\s+/)
    .map((p) => p.split("=").pop() ?? "")
    .filter(Boolean);
}

const valueOf = (part: string) => {
  const m = part.match(/^(-?[0-9.]+)\/([0-9.]+)$/);
  return m ? Number(m[1]) / Number(m[2]) : Number(part);
};

/** Whether what the student typed is the answer, in any order, with or without the letter, unit or base. */
export function checkAnswer(typed: string, finalLine: string): boolean {
  const want = answerParts(finalLine);
  const got = answerParts(typed);
  if (want.length === 0 || got.length !== want.length) return false;
  const same = (a: string, b: string) => {
    const x = valueOf(a);
    const y = valueOf(b);
    return Number.isNaN(x) || Number.isNaN(y) ? a === b : Math.abs(x - y) < 1e-9;
  };
  const left = [...got];
  for (const w of want) {
    const i = left.findIndex((g) => same(g, w));
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

