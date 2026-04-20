import { describe, it, expect } from "vitest";
import { parseBoard } from "./parser.js";
import { allCards } from "../models/types.js";

const FULL_PLANNER = `---
week: 7
year: 2026
tags: [planner, weekly]
quarter: Q1
startDate: 2026-02-09
endDate: 2026-02-15
---

# Week 7, 2026

## Monday, February 9, 2026

- [x] Morning standup #work
- [ ] Review PRs [2026-02-09] !!
  - [x] PR #123
  - [ ] PR #456
  Body note for review task

## Tuesday, February 10, 2026

- [/] Write parser #hexfield est:4h
- [ ] Update docs

# Backlog

## Now

- [ ] Fix critical bug !!! #core
- [ ] Deploy hotfix

## Next 2 Weeks

- [ ] Refactor auth module #backend

## This Month

- [ ] Performance audit est:8h

## This Quarter

- [ ] Launch v1.0 #hexfield [2026-03-31]

## This Year

- [ ] Conference talk proposal

## Parking Lot

- [ ] Rewrite in Rust
`;

describe("parseBoard", () => {
  it("parses a full planner file into boards", () => {
    const board = parseBoard(FULL_PLANNER);

    expect(board.frontmatter.week).toBe(7);
    expect(board.frontmatter.year).toBe(2026);
    expect(board.frontmatter.tags).toEqual(["planner", "weekly"]);
    expect(board.frontmatter.quarter).toBe("Q1");

    // 2 H1 boards: "Week 7, 2026" and "Backlog"
    expect(board.boards).toHaveLength(2);
    expect(board.boards[0].heading).toBe("Week 7, 2026");
    expect(board.boards[1].heading).toBe("Backlog");
  });

  it("parses rows within each board", () => {
    const board = parseBoard(FULL_PLANNER);
    const week = board.boards[0];
    const backlog = board.boards[1];

    // Week board has 2 day rows
    expect(week.rows).toHaveLength(2);
    expect(week.rows[0].heading).toBe("Monday, February 9, 2026");
    expect(week.rows[1].heading).toBe("Tuesday, February 10, 2026");

    // Backlog board has 6 rows
    expect(backlog.rows).toHaveLength(6);
    expect(backlog.rows[0].heading).toBe("Now");
    expect(backlog.rows[5].heading).toBe("Parking Lot");
  });

  it("classifies day rows correctly", () => {
    const board = parseBoard(FULL_PLANNER);
    const monday = board.boards[0].rows[0];
    const tuesday = board.boards[0].rows[1];

    expect(monday.dayName).toBe("Monday");
    expect(monday.date).toBe("2026-02-09");

    expect(tuesday.dayName).toBe("Tuesday");
    expect(tuesday.date).toBe("2026-02-10");
  });

  it("non-day rows have no dayName or date", () => {
    const board = parseBoard(FULL_PLANNER);
    const nowRow = board.boards[1].rows[0];

    expect(nowRow.dayName).toBeUndefined();
    expect(nowRow.date).toBeUndefined();
    expect(nowRow.heading).toBe("Now");
  });

  it("parses day row cards correctly", () => {
    const board = parseBoard(FULL_PLANNER);
    const monday = board.boards[0].rows[0];

    expect(monday.cards).toHaveLength(2);

    const standup = monday.cards[0];
    expect(standup.status).toBe("done");
    expect(standup.project).toBe("work");
    expect(standup.day).toBe("Monday");
    expect(standup.sectionHeading).toBe("Monday, February 9, 2026");
    expect(standup.boardHeading).toBe("Week 7, 2026");

    const review = monday.cards[1];
    expect(review.status).toBe("todo");
    expect(review.dueDate).toBe("2026-02-09");
    expect(review.priority).toBe("medium");
  });

  it("parses sub-tasks and body content", () => {
    const board = parseBoard(FULL_PLANNER);
    const review = board.boards[0].rows[0].cards[1];

    expect(review.subTasks).toHaveLength(2);
    expect(review.subTasks[0].text).toBe("PR #123");
    expect(review.subTasks[0].status).toBe("done");
    expect(review.subTasks[1].status).toBe("todo");
    expect(review.body).toContain("Body note for review task");
  });

  it("handles [/] checkbox as in-progress", () => {
    const board = parseBoard(FULL_PLANNER);
    const parser = board.boards[0].rows[1].cards[0];

    expect(parser.status).toBe("in-progress");
    expect(parser.project).toBe("hexfield");
    expect(parser.timeEstimate).toBe("4h");
  });

  it("parses backlog row cards with correct boardHeading", () => {
    const board = parseBoard(FULL_PLANNER);
    const backlog = board.boards[1];

    const nowRow = backlog.rows[0];
    expect(nowRow.cards).toHaveLength(2);
    expect(nowRow.cards[0].priority).toBe("high");
    expect(nowRow.cards[0].project).toBe("core");
    expect(nowRow.cards[0].sectionHeading).toBe("Now");
    expect(nowRow.cards[0].boardHeading).toBe("Backlog");

    const next2Row = backlog.rows[1];
    expect(next2Row.cards[0].project).toBe("backend");
    expect(next2Row.cards[0].sectionHeading).toBe("Next 2 Weeks");
    expect(next2Row.cards[0].boardHeading).toBe("Backlog");

    const thisMonthRow = backlog.rows[2];
    expect(thisMonthRow.cards[0].timeEstimate).toBe("8h");

    const thisQuarterRow = backlog.rows[3];
    expect(thisQuarterRow.cards[0].dueDate).toBe("2026-03-31");

    const parkingLotRow = backlog.rows[5];
    expect(parkingLotRow.cards[0].title).toBe("Rewrite in Rust");
  });

  it("collects all cards via allCards helper", () => {
    const board = parseBoard(FULL_PLANNER);
    const cards = allCards(board);
    // 2 Monday + 2 Tuesday + 2 Now + 1 Next2W + 1 ThisMonth + 1 Quarter + 1 Year + 1 Parking
    expect(cards).toHaveLength(11);
  });

  it("handles [-] checkbox as wont-do", () => {
    const input = `---
week: 1
year: 2026
tags: []
---

# Week 1

## Monday, February 2, 2026

- [-] Decided not to do this
- [ ] Still doing this
`;
    const board = parseBoard(input);
    const cards = board.boards[0].rows[0].cards;
    expect(cards[0].status).toBe("wont-do");
    expect(cards[0].title).toBe("Decided not to do this");
    expect(cards[1].status).toBe("todo");
  });

  it("H3 headings are ignored as structural elements", () => {
    const input = `---
week: 1
year: 2026
tags: []
---

# Backlog

## Active

### Priority (ignored)

- [ ] Task A
- [ ] Task B
`;
    const board = parseBoard(input);
    // One board with one row; H3 is skipped, cards still belong to the H2 row
    expect(board.boards).toHaveLength(1);
    expect(board.boards[0].rows).toHaveLength(1);
    expect(board.boards[0].rows[0].cards).toHaveLength(2);
    expect(board.boards[0].rows[0].cards[0].title).toBe("Task A");
  });

  it("H2 rows without a preceding H1 go into an implicit board", () => {
    const input = `---
week: 1
year: 2026
tags: []
---

## Sprint 1

- [ ] Build the thing #eng
- [/] Review the thing #eng

## Ideas

- [ ] Someday maybe
`;
    const board = parseBoard(input);
    // One implicit board (heading: "") with 2 rows
    expect(board.boards).toHaveLength(1);
    expect(board.boards[0].heading).toBe("");
    expect(board.boards[0].rows).toHaveLength(2);
    expect(board.boards[0].rows[0].heading).toBe("Sprint 1");
    expect(board.boards[0].rows[0].cards).toHaveLength(2);
    expect(board.boards[0].rows[1].heading).toBe("Ideas");
  });

  it("handles empty rows", () => {
    const input = `---
week: 1
year: 2026
tags: [planner]
---

# Week 1

## Monday, February 2, 2026

# Backlog

## Now
`;
    const board = parseBoard(input);
    expect(board.boards).toHaveLength(2);

    const day = board.boards[0].rows[0];
    const now = board.boards[1].rows[0];

    expect(day.dayName).toBe("Monday");
    expect(day.cards).toHaveLength(0);
    expect(now.heading).toBe("Now");
    expect(now.cards).toHaveLength(0);
  });

  it("skips bold text lines", () => {
    const input = `---
week: 1
year: 2026
tags: [planner]
---

## Monday, February 2, 2026

**Category Header**
- [ ] Actual task
`;
    const board = parseBoard(input);
    expect(board.boards[0].rows[0].cards).toHaveLength(1);
    expect(board.boards[0].rows[0].cards[0].title).toBe("Actual task");
  });

  it("handles file with no frontmatter", () => {
    const input = `## Monday, February 2, 2026

- [ ] A task
`;
    const board = parseBoard(input);
    expect(board.frontmatter.week).toBe(0);
    expect(board.boards).toHaveLength(1);
    expect(board.boards[0].rows).toHaveLength(1);
    expect(board.boards[0].rows[0].cards).toHaveLength(1);
  });

  it("assigns card IDs based on line numbers and sets heading fields", () => {
    const board = parseBoard(FULL_PLANNER);
    const card = board.boards[0].rows[0].cards[0];
    expect(card.id).toMatch(/^card-\d+$/);
    expect(card.lineNumber).toBeGreaterThan(0);
    expect(card.sectionHeading).toBe("Monday, February 9, 2026");
    expect(card.boardHeading).toBe("Week 7, 2026");
  });

  it("preserves rawLine for roundtripping", () => {
    const board = parseBoard(FULL_PLANNER);
    const card = board.boards[0].rows[0].cards[0];
    expect(card.rawLine).toBe("- [x] Morning standup #work");
  });

  it("multiple H1 boards coexist independently", () => {
    const input = `---
week: 1
year: 2026
tags: []
---

# Week 1

## Monday

- [ ] Task A

# Projects

## Hexfield

- [ ] Task B

## Deep 13

- [ ] Task C
`;
    const board = parseBoard(input);
    expect(board.boards).toHaveLength(2);

    const week = board.boards[0];
    expect(week.heading).toBe("Week 1");
    expect(week.rows).toHaveLength(1);
    expect(week.rows[0].cards[0].boardHeading).toBe("Week 1");

    const projects = board.boards[1];
    expect(projects.heading).toBe("Projects");
    expect(projects.rows).toHaveLength(2);
    expect(projects.rows[0].heading).toBe("Hexfield");
    expect(projects.rows[0].cards[0].boardHeading).toBe("Projects");
    expect(projects.rows[1].heading).toBe("Deep 13");
  });

  it("handles [!] checkbox as blocked", () => {
    const input = `---
week: 1
year: 2026
tags: []
---

# Week 1

## Monday, February 2, 2026

- [!] Blocked on external dependency
- [ ] Still todo
`;
    const board = parseBoard(input);
    const cards = board.boards[0].rows[0].cards;
    expect(cards[0].status).toBe("blocked");
    expect(cards[0].title).toBe("Blocked on external dependency");
    expect(cards[1].status).toBe("todo");
  });
});

// ---------------------------------------------------------------------------
// Implicit row — cards under H1 with no H2
// ---------------------------------------------------------------------------

describe("implicit row (cards under H1 with no H2)", () => {
  it("creates an implicit row for cards directly under H1", () => {
    const input = `# My Board\n\n- [ ] Task A\n- [x] Task B`;
    const result = parseBoard(input);
    expect(result.boards).toHaveLength(1);
    expect(result.boards[0].rows).toHaveLength(1);
    expect(result.boards[0].rows[0].heading).toBe("");
    expect(result.boards[0].rows[0].cards).toHaveLength(2);
    expect(result.boards[0].rows[0].cards[0].title).toBe("Task A");
    expect(result.boards[0].rows[0].cards[0].sectionHeading).toBe("");
    expect(result.boards[0].rows[0].cards[0].boardHeading).toBe("My Board");
  });

  it("implicit row comes before explicit H2 rows", () => {
    const input = `# Board\n\n- [ ] Orphan\n\n## Row A\n\n- [ ] Rowful`;
    const result = parseBoard(input);
    expect(result.boards[0].rows).toHaveLength(2);
    expect(result.boards[0].rows[0].heading).toBe("");
    expect(result.boards[0].rows[0].cards[0].title).toBe("Orphan");
    expect(result.boards[0].rows[1].heading).toBe("Row A");
    expect(result.boards[0].rows[1].cards[0].title).toBe("Rowful");
  });

  it("creates implicit board + implicit row when no headings at all", () => {
    const input = `- [ ] Bare task`;
    const result = parseBoard(input);
    expect(result.boards).toHaveLength(1);
    expect(result.boards[0].heading).toBe("");
    expect(result.boards[0].rows).toHaveLength(1);
    expect(result.boards[0].rows[0].heading).toBe("");
    expect(result.boards[0].rows[0].cards).toHaveLength(1);
  });

  it("only boards with orphan cards get implicit rows", () => {
    const input = [
      "# Board A",
      "- [ ] Orphan A",
      "# Board B",
      "## Row B",
      "- [ ] Card B",
    ].join("\n");
    const result = parseBoard(input);
    expect(result.boards[0].rows).toHaveLength(1);
    expect(result.boards[0].rows[0].heading).toBe("");
    expect(result.boards[1].rows).toHaveLength(1);
    expect(result.boards[1].rows[0].heading).toBe("Row B");
  });

  it("existing files with H2s produce no implicit rows", () => {
    const result = parseBoard(FULL_PLANNER);
    const cards = allCards(result);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.sectionHeading !== "")).toBe(true);
  });

  it("preserves sub-tasks and body on cards in implicit row", () => {
    const input = [
      "# Board",
      "- [ ] Parent task",
      "  A body note",
      "  - [x] Sub 1",
      "  - [ ] Sub 2",
    ].join("\n");
    const result = parseBoard(input);
    const card = result.boards[0].rows[0].cards[0];
    expect(card.title).toBe("Parent task");
    expect(card.body).toEqual(["A body note"]);
    expect(card.subTasks).toHaveLength(2);
    expect(card.subTasks[0].status).toBe("done");
  });
});
