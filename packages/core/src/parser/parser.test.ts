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
  it("parses a full planner file into sections", () => {
    const board = parseBoard(FULL_PLANNER);

    expect(board.frontmatter.week).toBe(7);
    expect(board.frontmatter.year).toBe(2026);
    expect(board.frontmatter.tags).toEqual(["planner", "weekly"]);
    expect(board.frontmatter.quarter).toBe("Q1");

    // 2 day + 1 bucket (Backlog) + 3 board (This Quarter, This Year, Parking Lot)
    expect(board.sections).toHaveLength(6);
  });

  it("classifies day sections correctly", () => {
    const board = parseBoard(FULL_PLANNER);
    const monday = board.sections[0];
    const tuesday = board.sections[1];

    expect(monday.type).toBe("day");
    expect(monday.heading).toBe("Monday, February 9, 2026");
    expect(monday.dayName).toBe("Monday");
    expect(monday.date).toBe("2026-02-09");

    expect(tuesday.type).toBe("day");
    expect(tuesday.dayName).toBe("Tuesday");
  });

  it("classifies bucket sections correctly", () => {
    const board = parseBoard(FULL_PLANNER);
    const backlog = board.sections[2];

    expect(backlog.type).toBe("bucket");
    expect(backlog.heading).toBe("Backlog");
    expect(backlog.buckets).toHaveLength(3);
    expect(backlog.buckets![0].heading).toBe("Now");
    expect(backlog.buckets![1].heading).toBe("Next 2 Weeks");
    expect(backlog.buckets![2].heading).toBe("This Month");
  });

  it("classifies board sections correctly", () => {
    const board = parseBoard(FULL_PLANNER);
    const thisQuarter = board.sections[3];
    const thisYear = board.sections[4];
    const parkingLot = board.sections[5];

    expect(thisQuarter.type).toBe("board");
    expect(thisQuarter.heading).toBe("This Quarter");
    expect(thisYear.type).toBe("board");
    expect(parkingLot.type).toBe("board");
    expect(parkingLot.heading).toBe("Parking Lot");
  });

  it("parses day section cards correctly", () => {
    const board = parseBoard(FULL_PLANNER);
    const monday = board.sections[0];

    expect(monday.cards).toHaveLength(2);

    const standup = monday.cards[0];
    expect(standup.status).toBe("done");
    expect(standup.project).toBe("work");
    expect(standup.day).toBe("Monday");
    expect(standup.sectionHeading).toBe("Monday, February 9, 2026");

    const review = monday.cards[1];
    expect(review.status).toBe("todo");
    expect(review.dueDate).toBe("2026-02-09");
    expect(review.priority).toBe("medium");
  });

  it("parses sub-tasks and body content", () => {
    const board = parseBoard(FULL_PLANNER);
    const review = board.sections[0].cards[1];

    expect(review.subTasks).toHaveLength(2);
    expect(review.subTasks[0].text).toBe("PR #123");
    expect(review.subTasks[0].status).toBe("done");
    expect(review.subTasks[1].status).toBe("todo");
    expect(review.body).toContain("Body note for review task");
  });

  it("handles [/] checkbox as in-progress", () => {
    const board = parseBoard(FULL_PLANNER);
    const parser = board.sections[1].cards[0];

    expect(parser.status).toBe("in-progress");
    expect(parser.project).toBe("hexfield");
    expect(parser.timeEstimate).toBe("4h");
  });

  it("parses bucket section cards with bucketHeading set", () => {
    const board = parseBoard(FULL_PLANNER);
    const backlog = board.sections[2];

    const nowBucket = backlog.buckets![0];
    expect(nowBucket.cards).toHaveLength(2);
    expect(nowBucket.cards[0].priority).toBe("high");
    expect(nowBucket.cards[0].project).toBe("core");
    expect(nowBucket.cards[0].sectionHeading).toBe("Backlog");
    expect(nowBucket.cards[0].bucketHeading).toBe("Now");

    const next2Bucket = backlog.buckets![1];
    expect(next2Bucket.cards[0].project).toBe("backend");
    expect(next2Bucket.cards[0].bucketHeading).toBe("Next 2 Weeks");

    const thisMonthBucket = backlog.buckets![2];
    expect(thisMonthBucket.cards[0].timeEstimate).toBe("8h");
  });

  it("parses board section cards correctly", () => {
    const board = parseBoard(FULL_PLANNER);

    const thisQuarter = board.sections[3];
    expect(thisQuarter.cards[0].project).toBe("hexfield");
    expect(thisQuarter.cards[0].dueDate).toBe("2026-03-31");
    expect(thisQuarter.cards[0].sectionHeading).toBe("This Quarter");

    const thisYear = board.sections[4];
    expect(thisYear.cards[0].title).toBe("Conference talk proposal");

    const parkingLot = board.sections[5];
    expect(parkingLot.cards[0].title).toBe("Rewrite in Rust");
    expect(parkingLot.cards[0].sectionHeading).toBe("Parking Lot");
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

## Monday, February 2, 2026

- [-] Decided not to do this
- [ ] Still doing this
`;
    const board = parseBoard(input);
    const cards = board.sections[0].cards;
    expect(cards[0].status).toBe("wont-do");
    expect(cards[0].title).toBe("Decided not to do this");
    expect(cards[1].status).toBe("todo");
  });

  it("handles arbitrary H2 sections as board type", () => {
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
    expect(board.sections).toHaveLength(2);
    expect(board.sections[0].type).toBe("board");
    expect(board.sections[0].heading).toBe("Sprint 1");
    expect(board.sections[0].cards).toHaveLength(2);
    expect(board.sections[1].type).toBe("board");
    expect(board.sections[1].heading).toBe("Ideas");
  });

  it("upgrades a section to bucket when H3 is encountered", () => {
    const input = `---
week: 1
year: 2026
tags: []
---

## Icebox

### Near Term

- [ ] Task A

### Long Term

- [ ] Task B
`;
    const board = parseBoard(input);
    expect(board.sections).toHaveLength(1);
    const icebox = board.sections[0];
    expect(icebox.type).toBe("bucket");
    expect(icebox.heading).toBe("Icebox");
    expect(icebox.buckets).toHaveLength(2);
    expect(icebox.buckets![0].heading).toBe("Near Term");
    expect(icebox.buckets![0].cards[0].title).toBe("Task A");
    expect(icebox.buckets![0].cards[0].bucketHeading).toBe("Near Term");
    expect(icebox.buckets![1].heading).toBe("Long Term");
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
    const day = board.sections[0];
    const backlog = board.sections[1];
    const quarter = board.sections[2];

    expect(day.type).toBe("day");
    expect(day.cards).toHaveLength(0);
    expect(backlog.type).toBe("bucket");
    expect(backlog.buckets![0].cards).toHaveLength(0);
    expect(quarter.type).toBe("board");
    expect(quarter.cards).toHaveLength(0);
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
    expect(board.sections[0].cards).toHaveLength(1);
    expect(board.sections[0].cards[0].title).toBe("Actual task");
  });

  it("handles file with no frontmatter", () => {
    const input = `## Monday, February 2, 2026

- [ ] A task
`;
    const board = parseBoard(input);
    expect(board.frontmatter.week).toBe(0);
    expect(board.sections).toHaveLength(1);
    expect(board.sections[0].cards).toHaveLength(1);
  });

  it("assigns card IDs based on line numbers and sets sectionHeading", () => {
    const board = parseBoard(FULL_PLANNER);
    const card = board.sections[0].cards[0];
    expect(card.id).toMatch(/^card-\d+$/);
    expect(card.lineNumber).toBeGreaterThan(0);
    expect(card.sectionHeading).toBe("Monday, February 9, 2026");
  });

  it("preserves rawLine for roundtripping", () => {
    const board = parseBoard(FULL_PLANNER);
    const card = board.sections[0].cards[0];
    expect(card.rawLine).toBe("- [x] Morning standup #work");
  });
});
