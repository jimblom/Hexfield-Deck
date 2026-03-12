/** YAML frontmatter from a planner file. */
export interface Frontmatter {
  week: number;
  year: number;
  tags: string[];
  quarter?: string;
  startDate?: string;
  endDate?: string;
}

/** Checkbox states. `wont-do` and `blocked` are hidden by default; filter-in via status filter. */
export type TaskStatus = "todo" | "in-progress" | "done" | "wont-do" | "blocked";

/** Priority markers: !!! = high, !! = medium, ! = low. */
export type Priority = "high" | "medium" | "low";

/** A sub-task nested under a card. */
export interface SubTask {
  text: string;
  status: TaskStatus;
  lineNumber: number;
}

/** A single task card. */
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
  /** The H2 heading of the row this card belongs to. Always set. */
  sectionHeading: string;
  /** The H1 heading of the board this card belongs to. Empty string if no H1 in file. */
  boardHeading: string;
  /** Day name shorthand for day rows (e.g. "Monday"). */
  day?: string;
}

/**
 * An H2 row within a board. Every H2 heading is a row — the swimlane unit.
 * Day rows (heading starts with a day name) additionally carry `dayName` and `date`.
 */
export interface Row {
  heading: string;
  /** Day name shorthand (day rows only, e.g. "Monday"). */
  dayName?: string;
  /** ISO date string (day rows only, e.g. "2026-02-09"). */
  date?: string;
  cards: Card[];
  lineNumber: number;
}

/**
 * An H1 board. Groups related H2 rows.
 * Files with no H1 headings produce a single implicit board with `heading: ""`.
 */
export interface Board {
  heading: string;
  rows: Row[];
  lineNumber: number;
}

/** The full parsed planner. */
export interface BoardData {
  frontmatter: Frontmatter;
  /** H1-level boards, each containing H2-level rows. */
  boards: Board[];
}

/** Collect every card across all boards and rows. */
export function allCards(boardData: BoardData): Card[] {
  return boardData.boards.flatMap((b) => b.rows.flatMap((r) => r.cards));
}
