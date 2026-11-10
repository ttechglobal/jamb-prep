/**
 * Works out, for one subject, which years we hold, which are fetched but not in the bank,
 * and which are gaps. Pure, so it can be tested without a database or the MyQuest API.
 */

export interface StagedInfo {
  status: string;
  fetched: number;
}

export type YearState = "gap" | "staged" | "held";

export interface YearRow {
  year: string;
  state: YearState;
  /** Questions already in the bank for this subject and year. */
  inBank: number;
  staged: StagedInfo | null;
}

/**
 * @param years  year ids as MyQuest lists them
 * @param bank   questions held per year, for this subject
 * @param staged papers already fetched, by year id
 * Newest year first.
 */
export function yearRows(years: string[], bank: Map<number, number>, staged: Map<string, StagedInfo>): YearRow[] {
  return [...years]
    .sort((a, b) => Number(b) - Number(a))
    .map((year) => {
      const inBank = /^\d{4}$/.test(year) ? (bank.get(Number(year)) ?? 0) : 0;
      const s = staged.get(year) ?? null;
      const state: YearState = inBank > 0 ? "held" : s ? "staged" : "gap";
      return { year, state, inBank, staged: s };
    });
}
