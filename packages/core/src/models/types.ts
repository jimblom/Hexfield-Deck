/** YAML frontmatter from a planner file. */
export interface Frontmatter {
  week: number;
  year: number;
  tags: string[];
  quarter?: string;
  startDate?: string;
  endDate?: string;
}

/** Checkbox states: unchecked, in-progress ([/]), checked. */
export type TaskStatus = "todo" | "in-progress" | "done";

/** Priority markers: !!! = high, !! = medium, ! = low. */
export type Priority = "high" | "medium" | "low";

/** Backlog sub-section identifiers. */
export type BacklogSection = "now" | "next-2-weeks" | "this-month";

/** Long-term section identifiers. */
export type LongTermSection = "this-quarter" | "this-year" | "parking-lot";

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
  day?: string;
  section?: string;
}

/** A day column (## Monday, February 5, 2026). */
export interface DaySection {
  heading: string;
  dayName: string;
  date?: string;
  cards: Card[];
  lineNumber: number;
}

/** A bucket within the ## Backlog section. */
export interface BacklogBucket {
  label: string;
  key: BacklogSection;
  cards: Card[];
  lineNumber: number;
}

/** The full parsed board. */
export interface BoardData {
  frontmatter: Frontmatter;
  days: DaySection[];
  backlog: BacklogBucket[];
  thisQuarter: Card[];
  thisYear: Card[];
  parkingLot: Card[];
}

/** Collect every card across all sections. */
export function allCards(board: BoardData): Card[] {
  const cards: Card[] = [];
  for (const day of board.days) {
    cards.push(...day.cards);
  }
  for (const bucket of board.backlog) {
    cards.push(...bucket.cards);
  }
  cards.push(...board.thisQuarter);
  cards.push(...board.thisYear);
  cards.push(...board.parkingLot);
  return cards;
}
