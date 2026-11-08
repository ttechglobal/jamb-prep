/**
 * The question content format. One format carries every subject, so one renderer can show
 * every question, and nothing needs to be guessed from raw text at display time.
 * Stored as JSON in Postgres. React renders it, so provider HTML can never run in the page.
 */

export type Mark =
  | "bold"
  | "italic"
  | "underline"
  | "double_underline"
  | "highlight"
  | "superscript"
  | "subscript";

/** A run of text, or a formula. Formulas are explicit, so ₦ and $ in prose stay plain text. */
export type Inline = { text: string; marks?: Mark[] } | { math: string };

export interface VerseLine {
  /** The source's own line number, shown only where the source prints one. */
  number?: number;
  content: Inline[];
}

export type TableAlign = "left" | "right" | "center";

/** null is a blank cell. A blank is not zero, so the two are stored differently. */
export type TableCell = Inline[] | null;

export interface TableBlock {
  type: "table";
  caption?: Inline[];
  /** Sets alignment for each column. Numeric columns should be "right". */
  align?: TableAlign[];
  header?: TableCell[][];
  rows: TableCell[][];
  /** Totals. Kept apart from rows so they can be ruled off. */
  footer?: TableCell[][];
}

export interface FigureBlock {
  type: "figure";
  /** Path in the question-media bucket, or a data: URI for fixtures. */
  src: string;
  /** What the learner needs to know from the image. Required. */
  alt: string;
  caption?: Inline[];
  width?: number;
  height?: number;
}

export type Block =
  | { type: "paragraph"; content: Inline[] }
  | { type: "math"; tex: string }
  /** A short quoted excerpt inside a stem, such as one line from a text. Shown set apart, like a page of the text. */
  | { type: "quote"; content: Inline[] }
  | { type: "verse"; stanzas: VerseLine[][] }
  | { type: "dialogue"; turns: { speaker: string; content: Inline[] }[] }
  | TableBlock
  | FigureBlock;

export type OptionKey = "A" | "B" | "C" | "D";

export interface QuestionOption {
  key: OptionKey;
  blocks: Block[];
}

export type ContextKind = "passage" | "poem" | "extract" | "dialogue" | "data" | "figure";

/** Material shared by several questions: stored once, shown with each. */
export interface SharedContext {
  id: string;
  kind: ContextKind;
  title: string | null;
  blocks: Block[];
  /** Author, source or publication, exactly as the source credits it. */
  credit: string | null;
}

export interface PrescribedWorkRef {
  title: string;
  author: string;
  /** Chapter or extract the question draws on. */
  reference: string | null;
}

export interface SolutionStep {
  title: string;
  blocks: Block[];
}

/** Everything held back until the mode allows it. */
export interface Solution {
  /** The reasoning that gets to the answer. */
  answer: Block[];
  concept?: string;
  intro?: Block[];
  formula?: Block[];
  variables?: Block[];
  steps?: SolutionStep[];
  wrongOptions?: Partial<Record<OptionKey, Block[]>>;
  studyTip?: Block[];
  /** Solution illustrations. Never sent before the answer is revealed. */
  figures?: Block[];
}
