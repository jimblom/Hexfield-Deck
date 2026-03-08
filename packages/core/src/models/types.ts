/** YAML frontmatter from a planner file. */
export interface Frontmatter {
  week: number;
  year: number;
  tags: string[];
  quarter?: string;
  startDate?: string;
  endDate?: string;
}

/** Checkbox states. `wont-do` is hidden by default; filter-in via status filter. */
export type TaskStatus = "todo" | "in-progress" | "done" | "wont-do";

/** Priority markers: !!! = high, !! = medium, ! = low. */
export type Priority = "high" | "medium" | "low";

/** A sub-task nested under a card. */
export interface SubTask {
  text: string;
  status: TaskStatus;
  lineNumber: number;
}

/** A single task card on the board. */
export interface Card {
  id: string;
  title: string;
  rawLine: string;
  status: TaskStatus;
  lineNumber: number;
  body: string[];
  subTasks: SubTask[];
  project?: string;
  dueDate?: string;
  priority?: Priority;
  timeEstimate?: string;
  /** The H2 heading of the section this card belongs to. Always set. */
  sectionHeading: string;
  /** The H3 heading of the bucket this card belongs to (bucket-type sections only). */
  bucketHeading?: string;
  /** Day name shorthand for day-type sections (e.g. "Monday"). */
  day?: string;
}

/** An H3 sub-section within a bucket-type section. */
export interface Bucket {
  heading: string;
  cards: Card[];
  lineNumber: number;
}

/**
 * A parsed H2 section. Type is inferred from structure (ADR-0008):
 * - `day`:    H2 heading starts with a day name.
 * - `bucket`: H2 section contains H3 sub-headings (discovered retroactively).
 * - `board`:  Any other H2 with direct task cards.
 */
export interface Section {
  heading: string;
  type: "day" | "board" | "bucket";
  /** Day name shorthand (day-type only, e.g. "Monday"). */
  dayName?: string;
  /** ISO date string (day-type only, e.g. "2026-02-09"). */
  date?: string;
  /** Direct cards (day and board sections). Empty for bucket sections. */
  cards: Card[];
  /** H3 sub-buckets (bucket-type sections only). */
  buckets?: Bucket[];
  lineNumber: number;
}

/** The full parsed board. */
export interface BoardData {
  frontmatter: Frontmatter;
  sections: Section[];
}

/** Collect every card across all sections. */
export function allCards(board: BoardData): Card[] {
  const result: Card[] = [];
  for (const section of board.sections) {
    if (section.type === "bucket" && section.buckets) {
      for (const bucket of section.buckets) {
        result.push(...bucket.cards);
      }
    } else {
      result.push(...section.cards);
    }
  }
  return result;
}
