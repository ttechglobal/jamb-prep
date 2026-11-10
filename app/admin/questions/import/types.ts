export interface Option {
  value: string;
  label: string;
}

export interface PaperInput {
  exam: string;
  year: string;
  subject: string;
}

export interface PaperStatus {
  /** Our subject id, or null when MyQuest has a subject we do not teach. */
  subjectId: string | null;
  inBank: number;
  staged: { status: string; fetched: number; pages: number } | null;
}

export interface FetchResult {
  paperKey: string;
  pages: number;
  rows: number;
  complete: boolean;
  /** Plain-language reasons the paper does not add up. */
  problems: string[];
  charged: string | null;
  balance: string | null;
}

export interface DryRunRow {
  providerId: string | number;
  status: "ready" | "held" | "rejected";
  reasons: string[];
  stem: string;
  key: string | null;
}

export interface DryRunResult {
  report: {
    total: number;
    ready: number;
    held: number;
    rejected: number;
    byReason: Record<string, number>;
    keyCounts: Record<string, number>;
    keySkew: boolean;
  };
  rows: DryRunRow[];
}

export type Outcome<T> = ({ ok: true } & T) | { ok: false; error: string };

/** What each reason code means to the person reviewing. */
export const REASON_LABEL: Record<string, string> = {
  bad_row: "Row has no id",
  blank_stem: "Question text is empty",
  missing_answer: "No answer key",
  invalid_answer: "Answer key is not A to D",
  answer_not_in_options: "Answer key points at an option that is not there",
  not_four_options: "Does not have four options",
  wrong_option_count: "Does not have four options",
  empty_option: "An option is empty",
  duplicate_option_text: "Two options say the same thing",
  option_label_stripped: "Option letter removed from the text",
  missing_explanation: "No explanation",
  placeholder_explanation: "Explanation is a placeholder",
  explanation_admits_problem: "Explanation admits a problem with the question",
  explanation_names_other_option: "Explanation names a different answer than the key",
  figure_needs_media: "Has a diagram that still needs saving and describing",
  missing_figure: "Refers to a diagram that is not attached",
  missing_table: "Refers to a table that is not attached",
  missing_extract: "Refers to a passage that is not attached",
  unresolved_marked_text: "Refers to marked text that is not marked",
  figure_without_alt: "Diagram has no description",
  uneven_table: "Table rows are uneven",
  duplicate_in_paper: "Same question appears twice in this paper",
};

/** What a reconcile issue code means. */
export function describeIssue(i: { code: string; [k: string]: unknown }): string {
  switch (i.code) {
    case "no_pages":
      return "No pages came back.";
    case "empty_page":
      return `Page ${i.page} had no questions.`;
    case "page_gap":
      return `Pages ${(i.missing as number[]).join(", ")} are missing.`;
    case "page_number_mismatch":
      return `Page ${i.page} came back labelled as page ${i.reported}.`;
    case "repeated_page":
      return `Pages ${(i.pages as number[]).join(" and ")} are identical, so one was repeated.`;
    case "duplicate_ids":
      return `The same question id appears more than once (${(i.ids as unknown[]).slice(0, 5).join(", ")}).`;
    case "missing_id":
      return `A question on page ${i.page} has no id.`;
    case "total_mismatch":
      return `MyQuest says ${i.expected} questions, but ${i.fetched} came back.`;
    case "page_count_mismatch":
      return `MyQuest says ${i.expected} pages, but ${i.fetched} came back.`;
    case "no_total_reported":
      return "MyQuest did not say how many questions to expect, so completeness can't be checked.";
    default:
      return String(i.code);
  }
}
