import type {
  BoardData,
  Card,
  TaskStatus,
  DaySection,
  BacklogBucket,
  BacklogSection,
} from "../models/types.js";
import { parseFrontmatter } from "./frontmatter.js";
import { parseAllMetadata } from "./metadata.js";

// Day names for detecting day headings
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// Backlog bucket heading → key mapping
const BACKLOG_BUCKETS: Record<string, BacklogSection> = {
  now: "now",
  "next 2 weeks": "next-2-weeks",
  "this month": "this-month",
};

type SectionType =
  | "none"
  | "day"
  | "backlog"
  | "this-quarter"
  | "this-year"
  | "parking-lot";

const CHECKBOX_RE = /^- \[([ x/])\] (.+)$/;
const INDENTED_CHECKBOX_RE = /^\s+- \[([ x/])\] (.+)$/;

function checkboxToStatus(marker: string): TaskStatus {
  switch (marker) {
    case "x":
      return "done";
    case "/":
      return "in-progress";
    default:
      return "todo";
  }
}

/** Try to parse an ISO date from a day heading like "Monday, February 5, 2026". */
function parseDayDate(heading: string): string | undefined {
  // Extract "Month Day, Year" portion
  const match = heading.match(
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
  );
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

  const days: DaySection[] = [];
  const backlog: BacklogBucket[] = [];
  const thisQuarter: Card[] = [];
  const thisYear: Card[] = [];
  const parkingLot: Card[] = [];

  let sectionType: SectionType = "none";
  let currentDay: DaySection | null = null;
  let currentBucket: BacklogBucket | null = null;

  /** Where to push completed cards. */
  function currentCardTarget(): Card[] | null {
    switch (sectionType) {
      case "day":
        return currentDay?.cards ?? null;
      case "backlog":
        return currentBucket?.cards ?? null;
      case "this-quarter":
        return thisQuarter;
      case "this-year":
        return thisYear;
      case "parking-lot":
        return parkingLot;
      default:
        return null;
    }
  }

  // Current card being built (multi-line collection)
  let pendingCard: Card | null = null;

  function flushCard(): void {
    if (!pendingCard) return;
    const target = currentCardTarget();
    if (target) target.push(pendingCard);
    pendingCard = null;
  }

  for (let i = bodyStartLine; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1; // 1-based

    // --- Heading detection ---
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      flushCard();
      const heading = h2Match[1].trim();

      // Check for day heading
      const dayName = DAY_NAMES.find((d) => heading.startsWith(d));
      if (dayName) {
        sectionType = "day";
        currentDay = {
          heading,
          dayName,
          date: parseDayDate(heading),
          cards: [],
          lineNumber,
        };
        days.push(currentDay);
        currentBucket = null;
        continue;
      }

      // Check for named sections
      const lower = heading.toLowerCase();
      if (lower === "backlog") {
        sectionType = "backlog";
        currentDay = null;
        currentBucket = null;
        continue;
      }
      if (lower === "this quarter") {
        sectionType = "this-quarter";
        currentDay = null;
        currentBucket = null;
        continue;
      }
      if (lower === "this year") {
        sectionType = "this-year";
        currentDay = null;
        currentBucket = null;
        continue;
      }
      if (lower === "parking lot") {
        sectionType = "parking-lot";
        currentDay = null;
        currentBucket = null;
        continue;
      }

      // Any other ## exits current section
      sectionType = "none";
      currentDay = null;
      currentBucket = null;
      continue;
    }

    const h3Match = line.match(/^### (.+)$/);
    if (h3Match && sectionType === "backlog") {
      flushCard();
      const label = h3Match[1].trim();
      const key = BACKLOG_BUCKETS[label.toLowerCase()];
      if (key) {
        currentBucket = { label, key, cards: [], lineNumber };
        backlog.push(currentBucket);
      }
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
        ...(meta.project !== undefined ? { project: meta.project } : {}),
        ...(meta.dueDate !== undefined ? { dueDate: meta.dueDate } : {}),
        ...(meta.priority !== undefined ? { priority: meta.priority } : {}),
        ...(meta.timeEstimate !== undefined
          ? { timeEstimate: meta.timeEstimate }
          : {}),
        ...(sectionType === "day" && currentDay
          ? { day: currentDay.dayName }
          : {}),
        ...(sectionType === "backlog" && currentBucket
          ? { section: currentBucket.key }
          : {}),
        ...(sectionType === "this-quarter" ? { section: "this-quarter" } : {}),
        ...(sectionType === "this-year" ? { section: "this-year" } : {}),
        ...(sectionType === "parking-lot" ? { section: "parking-lot" } : {}),
      };
      continue;
    }

    // --- Indented content (belongs to current card) ---
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

    // --- Blank line or non-indented non-checkbox → flush card ---
    if (pendingCard && !line.match(CHECKBOX_RE)) {
      // Only flush if line is blank or non-indented
      if (line.trim() === "") {
        // Keep collecting — blank lines between indented blocks are OK
        continue;
      }
      flushCard();
    }
  }

  // Flush any trailing card
  flushCard();

  return {
    frontmatter: frontmatter ?? {
      week: 0,
      year: 0,
      tags: [],
    },
    days,
    backlog,
    thisQuarter,
    thisYear,
    parkingLot,
  };
}
