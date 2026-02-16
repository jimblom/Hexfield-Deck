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

## Monday, February 9, 2026

- [x] Morning standup #work
- [ ] Review PRs [2026-02-09] !!
  - [x] PR #123
  - [ ] PR #456
  Body note for review task

## Tuesday, February 10, 2026

- [/] Write parser #hexfield est:4h
- [ ] Update docs

## Backlog

### Now

- [ ] Fix critical bug !!! #core
- [ ] Deploy hotfix

### Next 2 Weeks

- [ ] Refactor auth module #backend

### This Month

- [ ] Performance audit est:8h

## This Quarter

- [ ] Launch v1.0 #hexfield [2026-03-31]

## This Year

- [ ] Conference talk proposal

## Parking Lot

- [ ] Rewrite in Rust
`;

describe("parseBoard", () => {
  it("parses a full planner file", () => {
    const board = parseBoard(FULL_PLANNER);

    // Frontmatter
    expect(board.frontmatter.week).toBe(7);
    expect(board.frontmatter.year).toBe(2026);
    expect(board.frontmatter.tags).toEqual(["planner", "weekly"]);
    expect(board.frontmatter.quarter).toBe("Q1");
    expect(board.frontmatter.startDate).toBe("2026-02-09");
    expect(board.frontmatter.endDate).toBe("2026-02-15");

    // Days
    expect(board.days).toHaveLength(2);
    expect(board.days[0].dayName).toBe("Monday");
    expect(board.days[0].date).toBe("2026-02-09");
    expect(board.days[1].dayName).toBe("Tuesday");

    // Backlog
    expect(board.backlog).toHaveLength(3);
    expect(board.backlog[0].key).toBe("now");
    expect(board.backlog[1].key).toBe("next-2-weeks");
    expect(board.backlog[2].key).toBe("this-month");

    // Long-term sections
    expect(board.thisQuarter).toHaveLength(1);
    expect(board.thisYear).toHaveLength(1);
    expect(board.parkingLot).toHaveLength(1);
  });

  it("parses day section cards correctly", () => {
    const board = parseBoard(FULL_PLANNER);
    const monday = board.days[0];

    expect(monday.cards).toHaveLength(2);

    const standup = monday.cards[0];
    expect(standup.status).toBe("done");
    expect(standup.project).toBe("work");
    expect(standup.day).toBe("Monday");

    const review = monday.cards[1];
    expect(review.status).toBe("todo");
    expect(review.dueDate).toBe("2026-02-09");
    expect(review.priority).toBe("medium");
  });

  it("parses sub-tasks and body content", () => {
    const board = parseBoard(FULL_PLANNER);
    const review = board.days[0].cards[1];

    expect(review.subTasks).toHaveLength(2);
    expect(review.subTasks[0].text).toBe("PR #123");
    expect(review.subTasks[0].status).toBe("done");
    expect(review.subTasks[1].text).toBe("PR #456");
    expect(review.subTasks[1].status).toBe("todo");

    expect(review.body).toContain("Body note for review task");
  });

  it("handles [/] checkbox as in-progress", () => {
    const board = parseBoard(FULL_PLANNER);
    const tuesday = board.days[1];
    const parser = tuesday.cards[0];

    expect(parser.status).toBe("in-progress");
    expect(parser.project).toBe("hexfield");
    expect(parser.timeEstimate).toBe("4h");
  });

  it("parses backlog bucket cards", () => {
    const board = parseBoard(FULL_PLANNER);

    const now = board.backlog[0];
    expect(now.cards).toHaveLength(2);
    expect(now.cards[0].priority).toBe("high");
    expect(now.cards[0].project).toBe("core");
    expect(now.cards[0].section).toBe("now");

    const next2 = board.backlog[1];
    expect(next2.cards).toHaveLength(1);
    expect(next2.cards[0].project).toBe("backend");

    const thisMonth = board.backlog[2];
    expect(thisMonth.cards).toHaveLength(1);
    expect(thisMonth.cards[0].timeEstimate).toBe("8h");
  });

  it("parses long-term section cards", () => {
    const board = parseBoard(FULL_PLANNER);

    expect(board.thisQuarter[0].project).toBe("hexfield");
    expect(board.thisQuarter[0].dueDate).toBe("2026-03-31");
    expect(board.thisQuarter[0].section).toBe("this-quarter");

    expect(board.thisYear[0].title).toBe("Conference talk proposal");
    expect(board.thisYear[0].section).toBe("this-year");

    expect(board.parkingLot[0].title).toBe("Rewrite in Rust");
    expect(board.parkingLot[0].section).toBe("parking-lot");
  });

  it("collects all cards via allCards helper", () => {
    const board = parseBoard(FULL_PLANNER);
    const cards = allCards(board);
    // 2 Monday + 2 Tuesday + 2 Now + 1 Next2W + 1 ThisMonth + 1 Quarter + 1 Year + 1 Parking
    expect(cards).toHaveLength(11);
  });

  it("handles empty sections", () => {
    const input = `---
week: 1
year: 2026
tags: [planner]
---

## Monday, February 2, 2026

## Backlog

### Now

## This Quarter
`;
    const board = parseBoard(input);
    expect(board.days).toHaveLength(1);
    expect(board.days[0].cards).toHaveLength(0);
    expect(board.backlog).toHaveLength(1);
    expect(board.backlog[0].cards).toHaveLength(0);
    expect(board.thisQuarter).toHaveLength(0);
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
    expect(board.days[0].cards).toHaveLength(1);
    expect(board.days[0].cards[0].title).toBe("Actual task");
  });

  it("handles file with no frontmatter", () => {
    const input = `## Monday, February 2, 2026

- [ ] A task
`;
    const board = parseBoard(input);
    expect(board.frontmatter.week).toBe(0);
    expect(board.frontmatter.year).toBe(0);
    expect(board.days).toHaveLength(1);
    expect(board.days[0].cards).toHaveLength(1);
  });

  it("assigns card IDs based on line numbers", () => {
    const board = parseBoard(FULL_PLANNER);
    const card = board.days[0].cards[0];
    expect(card.id).toMatch(/^card-\d+$/);
    expect(card.lineNumber).toBeGreaterThan(0);
  });

  it("preserves rawLine for roundtripping", () => {
    const board = parseBoard(FULL_PLANNER);
    const card = board.days[0].cards[0];
    expect(card.rawLine).toBe("- [x] Morning standup #work");
  });
});
