import type { PathCheckpoint, PathOrder, PathUnit } from "./types";

/** A mixed check comes after this many units. */
export const SECTION_SIZE = 5;

export interface PathSection {
  index: number;
  title: string;
  units: PathUnit[];
  /** The mixed check at the end of the section. Only full sections have one. */
  check: { unitIds: string[]; done: boolean } | null;
}

const rank = (u: PathUnit, order: PathOrder) => (order === "syllabus" ? u.syllabusRank : u.askedRank);

export function orderUnits(units: PathUnit[], order: PathOrder): PathUnit[] {
  return [...units].sort((a, b) => rank(a, order) - rank(b, order));
}

function sectionTitle(index: number, order: PathOrder) {
  if (order === "syllabus") return `Part ${index + 1}`;
  return ["Most asked", "Often asked", "Rounding out"][index] ?? `Part ${index + 1}`;
}

/** Splits the ordered units into sections of five, marking which mixed checks are already done. */
export function buildSections(units: PathUnit[], order: PathOrder, checkpoints: PathCheckpoint[]): PathSection[] {
  const ordered = orderUnits(units, order);
  const sections: PathSection[] = [];
  for (let i = 0; i < ordered.length; i += SECTION_SIZE) {
    const chunk = ordered.slice(i, i + SECTION_SIZE);
    const ids = chunk.map((u) => u.id);
    const key = [...ids].sort().join(",");
    sections.push({
      index: sections.length,
      title: sectionTitle(sections.length, order),
      units: chunk,
      check:
        chunk.length === SECTION_SIZE
          ? { unitIds: ids, done: checkpoints.some((c) => [...c.unitIds].sort().join(",") === key) }
          : null,
    });
  }
  return sections;
}

/** The first unit with no stars, else the first still short of three. Null once every unit has three. */
export function nextUnit(units: PathUnit[], order: PathOrder): PathUnit | null {
  const ordered = orderUnits(units, order);
  return ordered.find((u) => u.stars === 0) ?? ordered.find((u) => u.stars < 3) ?? null;
}

/** Whether a unit has been started, for the "x of y started" line. */
export const isStarted = (u: PathUnit) => u.answers > 0;
