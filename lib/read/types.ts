import type { Inline } from "@/lib/content/types";

/** What the Read page needs from EXL Learn, already flattened. Nothing in the browser talks to EXL itself. */

export type ReadLessonSummary = {
  id: string;
  title: string;
  description: string;
  minutes: number | null;
  /** The EXL topic or subtopic this lesson sits under. Used to find the matching JAMB topic. */
  topicTitle: string;
  /** "embed" lessons are shown in EXL's own reader; "notes" are rendered here from lesson data. */
  format: "embed" | "notes";
};

export type ReadTopic = { id: string; title: string; lessons: ReadLessonSummary[] };

export type ReadSubject = {
  /** EXL's subject slug. */
  slug: string;
  name: string;
  /** The JAMB Prep subject this is, or null when EXL has a subject the app does not. */
  subjectId: string | null;
  topics: ReadTopic[];
};

export type ReadCatalogue = { subjects: ReadSubject[] };

export type ReadBlock =
  | { kind: "text"; paragraphs: Inline[][] }
  | { kind: "terms"; terms: { term: string; meaning: string }[] }
  | { kind: "callout"; tone: "tip" | "mistake" | "know"; title: string; text: Inline[] }
  | { kind: "equation"; tex: string; caption: string; explanation: string }
  | { kind: "points"; title: string; items: string[] };

export type ReadSection = { id: string; title: string; blocks: ReadBlock[] };

export type ReadLesson = {
  id: string;
  title: string;
  description: string;
  minutes: number | null;
  format: "embed" | "notes";
  subjectSlug: string;
  subjectId: string | null;
  topicTitle: string;
  /** The broader EXL topic above topicTitle. */
  groupTitle: string;
  sections: ReadSection[];
};
