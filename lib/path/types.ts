export type PathOrder = "asked" | "syllabus";
export type PathMode = "path" | "practice";

/** One step on the trail: a named group of topics, with what this student has earned on it. */
export interface PathUnit {
  id: string;
  slug: string;
  name: string;
  questionCount: number;
  askedRank: number;
  syllabusRank: number;
  /** 0 to 3. Earned and kept. */
  stars: 0 | 1 | 2 | 3;
  answers: number;
  days: number;
  /** A started unit whose recent answers have slipped. A live flag, never a lost star. */
  revisit: boolean;
}

export interface PathCheckpoint {
  unitIds: string[];
  accuracy: number | null;
  at: string;
}

export interface PathData {
  subjectId: string;
  units: PathUnit[];
  checkpoints: PathCheckpoint[];
  prefs: { mode: PathMode | null; order: PathOrder | null };
}

export interface PathOverviewSubject {
  subjectId: string;
  unitCount: number;
  started: number;
  stars: number;
  maxStars: number;
  next: { id: string; name: string; index: number } | null;
}

export interface PathOverview {
  mode: PathMode | null;
  order: PathOrder;
  subjects: PathOverviewSubject[];
}

/** What a finished round did to the path. Part of the session reward. */
export interface PathReward {
  unitId: string | null;
  starsBefore: number | null;
  starsAfter: number | null;
  checkpoint: boolean;
  units: { unitId: string; starsBefore: number; starsAfter: number }[];
}
