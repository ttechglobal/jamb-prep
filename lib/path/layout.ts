import type { PathCheckpoint, PathOrder, PathUnit } from "./types";

/** In "most asked" order, units are grouped in fives. */
export const SECTION_SIZE = 5;
/** A section gets a mixed check once it has at least this many units. */
export const CHECK_MIN_UNITS = 3;

export interface PathSection {
  index: number;
  title: string;
  units: PathUnit[];
  /** The mixed check at the end of the section. */
  check: { unitIds: string[]; done: boolean } | null;
}

const rank = (u: PathUnit, order: PathOrder) => (order === "syllabus" ? u.syllabusRank : u.askedRank);

export function orderUnits(units: PathUnit[], order: PathOrder): PathUnit[] {
  return [...units].sort((a, b) => rank(a, order) - rank(b, order));
}

function askedTitle(index: number) {
  return ["Most asked", "Often asked", "Rounding out"][index] ?? `More topics ${index - 2}`;
}

/**
 * Splits the ordered units into sections. Syllabus order follows the syllabus themes ("Algebra"), and
 * a topic nobody has themed yet lands under "More topics". Most-asked order is groups of five.
 */
export function buildSections(units: PathUnit[], order: PathOrder, checkpoints: PathCheckpoint[]): PathSection[] {
  const ordered = orderUnits(units, order);
  const groups: { title: string; units: PathUnit[] }[] = [];

  if (order === "syllabus") {
    for (const unit of ordered) {
      const title = unit.theme ?? "More topics";
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.units.push(unit);
      else groups.push({ title, units: [unit] });
    }
  } else {
    for (let i = 0; i < ordered.length; i += SECTION_SIZE) {
      groups.push({ title: askedTitle(groups.length), units: ordered.slice(i, i + SECTION_SIZE) });
    }
  }

  return groups.map((group, index) => {
    const ids = group.units.map((u) => u.id);
    const key = [...ids].sort().join(",");
    return {
      index,
      title: group.title,
      units: group.units,
      check:
        group.units.length >= CHECK_MIN_UNITS
          ? { unitIds: ids, done: checkpoints.some((c) => [...c.unitIds].sort().join(",") === key) }
          : null,
    };
  });
}

/** The first unit with no stars, else the first still short of three. Null once every unit has three. */
export function nextUnit(units: PathUnit[], order: PathOrder): PathUnit | null {
  const ordered = orderUnits(units, order);
  return ordered.find((u) => u.stars === 0) ?? ordered.find((u) => u.stars < 3) ?? null;
}

/** Whether a unit has been started, for the "x of y started" line. */
export const isStarted = (u: PathUnit) => u.answers > 0;
