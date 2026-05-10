import type {
  BoardData,
  Board,
  Row,
  Card,
  TaskStatus,
} from "../models/types.js";
import { parseFrontmatter } from "./frontmatter.js";
import { parseAllMetadata } from "./metadata.js";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const CHECKBOX_RE = /^- \[([ x/!-])\] (.+)$/;
const INDENTED_CHECKBOX_RE = /^\s+- \[([ x/!-])\] (.+)$/;

function checkboxToStatus(marker: string): TaskStatus {
  switch (marker) {
    case "x":
      return "done";
    case "/":
      return "in-progress";
    case "-":
      return "wont-do";
    case "!":
      return "blocked";
    default:
      return "todo";
  }
}

/** Try to parse an ISO date from a day heading like "Monday, February 5, 2026". */
function parseDayDate(heading: string): string | undefined {
  const match = heading.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!match) return undefined;
  const [, monthName, dayStr, yearStr] = match;
  const months: Record<string, number> = {
    January: 0, February: 1, March: 2, April: 3,
    May: 4, June: 5, July: 6, August: 7,
    September: 8, October: 9, November: 10, December: 11,
  };
  const monthIndex = months[monthName];
  if (monthIndex === undefined) return undefined;
  const d = new Date(Number(yearStr), monthIndex, Number(dayStr));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse a full planner markdown file into BoardData. */
export function parseBoard(input: string): BoardData {
  const lines = input.split(/\r?\n/);
  const { frontmatter, bodyStartLine } = parseFrontmatter(lines);

  const boards: Board[] = [];
  let currentBoard: Board | null = null;
  let currentRow: Row | null = null;
  let pendingCard: Card | null = null;

  function flushCard(): void {
    if (!pendingCard || !currentRow) return;
    currentRow.cards.push(pendingCard);
    pendingCard = null;
  }

  /** Ensure an implicit board exists when an H2 appears with no preceding H1. */
  function ensureBoard(lineNumber: number): Board {
    if (!currentBoard) {
      currentBoard = { heading: "", rows: [], lineNumber };
      boards.push(currentBoard);
    }
    return currentBoard;
  }

  /** Ensure an implicit row exists when a card appears with no preceding H2. */
  function ensureRow(lineNumber: number): Row {
    if (!currentRow) {
      const board = ensureBoard(lineNumber);
      currentRow = { heading: "", cards: [], lineNumber: board.lineNumber };
      board.rows.unshift(currentRow);
    }
    return currentRow;
  }

  for (let i = bodyStartLine; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // --- H1 heading: new board ---
    const h1Match = line.match(/^# (.+)$/);
    if (h1Match) {
      flushCard();
      const heading = h1Match[1].trim();
      currentRow = null;
      currentBoard = { heading, rows: [], lineNumber };
      boards.push(currentBoard);
      continue;
    }

    // --- H2 heading: new row ---
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      flushCard();
      const heading = h2Match[1].trim();
      const board = ensureBoard(lineNumber);
      const dayName = DAY_NAMES.find((d) => heading.startsWith(d));
      currentRow = {
        heading,
        ...(dayName ? { dayName, date: parseDayDate(heading) } : {}),
        cards: [],
        lineNumber,
      };
      board.rows.push(currentRow);
      continue;
    }

    // --- H3+: no structural significance — flush pending card and skip ---
    if (/^#{3,}/.test(line)) {
      flushCard();
      continue;
    }

    // --- Skip bold-only lines ---
    if (/^\*\*.+\*\*$/.test(line.trim())) {
      continue;
    }

    // --- Top-level checkbox (card) ---
    const checkboxMatch = line.match(CHECKBOX_RE);
    if (checkboxMatch) {
      flushCard();
      const row = ensureRow(lineNumber);
      const status = checkboxToStatus(checkboxMatch[1]);
      const rawText = checkboxMatch[2];
      const meta = parseAllMetadata(rawText);

      pendingCard = {
        id: `card-${lineNumber}`,
        title: meta.cleanTitle,
        rawLine: line,
        status,
        lineNumber,
        body: [],
        subTasks: [],
        tags: meta.tags,
        sectionHeading: row.heading,
        boardHeading: currentBoard?.heading ?? "",
        ...(meta.comment !== undefined ? { comment: meta.comment } : {}),
        ...(meta.project !== undefined ? { project: meta.project } : {}),
        ...(meta.dueDate !== undefined ? { dueDate: meta.dueDate } : {}),
        ...(meta.priority !== undefined ? { priority: meta.priority } : {}),
        ...(meta.timeEstimate !== undefined ? { timeEstimate: meta.timeEstimate } : {}),
        ...(row.dayName ? { day: row.dayName } : {}),
      };
      continue;
    }

    // --- Indented content (sub-tasks and body) ---
    if (pendingCard && /^\s+/.test(line)) {
      const subMatch = line.match(INDENTED_CHECKBOX_RE);
      if (subMatch) {
        pendingCard.subTasks.push({
          text: subMatch[2],
          status: checkboxToStatus(subMatch[1]),
          lineNumber,
        });
      } else if (line.trim().length > 0) {
        pendingCard.body.push(line.trimStart());
      }
      continue;
    }

    // --- Blank line or non-indented non-checkbox: flush ---
    if (pendingCard && !line.match(CHECKBOX_RE)) {
      if (line.trim() === "") {
        continue;
      }
      flushCard();
    }
  }

  flushCard();

  return {
    frontmatter: frontmatter ?? { week: 0, year: 0, tags: [] },
    boards,
  };
}
