/**
 * Mixes the order of a question's options at publish time, so answers are not bunched on one letter.
 * Keys are reassigned A to D in the new order, and the correct letter and the per-option reasons move with
 * their options. The same question always shuffles the same way (seeded by its source id), so publishing
 * again after an undo gives the same result.
 *
 * Options that point at each other ("all of the above", "both A and B") only make sense in their written
 * order, and a stem that names an option by letter does too. Those questions are left exactly as they are.
 */
import { createHash } from "node:crypto";
import type { Block, OptionKey, QuestionOption, Solution } from "../../content/types.ts";
import { plainText } from "../../content/validate.ts";

const KEYS: OptionKey[] = ["A", "B", "C", "D"];
const POINTS_AT_OPTIONS = /\b(?:all|none|neither|both|any)\s+of\s+(?:the\s+)?(?:above|these|them)\b|\bboth\s+[A-D]\b|^\s*(?:both\s+)?[A-D]\s*(?:,|and|&|or)\s*[A-D]\b|\b(?:option|options|choice|answer)\s+\(?[A-D]\)?(?![A-Za-z])|\babove\b|\bbelow\b/i;

export function canShuffle(stem: Block[], options: QuestionOption[]): boolean {
  if (options.length !== 4) return false;
  if (/\b(?:option|options|choice)\s+\(?[A-D]\)?(?![A-Za-z])/i.test(plainText(stem))) return false;
  return !options.some((o) => POINTS_AT_OPTIONS.test(plainText(o.blocks)));
}

function seededOrder(seed: string): number[] {
  const bytes = createHash("sha256").update(seed).digest();
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export interface Shuffled {
  options: QuestionOption[];
  correct: OptionKey;
  solution: Solution | null;
  shuffled: boolean;
}

export function shuffleOptions(seed: string, stem: Block[], options: QuestionOption[], correct: OptionKey, solution: Solution | null): Shuffled {
  const same: Shuffled = { options, correct, solution, shuffled: false };
  if (!canShuffle(stem, options)) return same;
  const sorted = [...options].sort((a, b) => a.key.localeCompare(b.key));
  const order = seededOrder(seed);
  if (order.every((v, i) => v === i)) return same;
  const newKey = new Map<OptionKey, OptionKey>();
  const next = order.map((from, i) => {
    newKey.set(sorted[from].key, KEYS[i]);
    return { ...sorted[from], key: KEYS[i] };
  });
  const wrong = solution?.wrongOptions;
  const moved = wrong ? Object.fromEntries(Object.entries(wrong).map(([k, v]) => [newKey.get(k as OptionKey) ?? k, v])) : undefined;
  return {
    options: next,
    correct: newKey.get(correct) ?? correct,
    solution: solution && moved ? { ...solution, wrongOptions: moved } : solution,
    shuffled: true,
  };
}
