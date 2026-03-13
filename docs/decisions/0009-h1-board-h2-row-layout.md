# ADR-0009: H1 Board / H2 Row Layout Convention

**Status:** Accepted
**Date:** 2026-03-07
**Deciders:** Jim Lindblom
**Supersedes:** ADR-0008 (Convention-Based Section Model)

## Context

ADR-0008 established H2 headings as the structural unit and explicitly reserved H1 headings for
future consideration ("Multiple H1 sections as a 'multi-planner' boundary is a post-v1.0.0
consideration"). ADR-0008 also introduced a three-way type system for H2 sections: `day`, `board`,
and `bucket` — where `bucket` sections contained H3 sub-headings.

In practice this created friction:

1. **The bucket / H3 model was inconsistent.** The Backlog section was special — a `## Backlog`
   with H3 sub-sections (`### Now`, `### Next 2 Weeks`) — while "This Quarter," "This Year," and
   "Parking Lot" were plain `board`-type H2 sections. Users had no clean mental model for when to
   use H3 vs. a flat H2.

2. **The swimlane showed only day rows.** Non-day sections were collapsed into a single synthetic
   "Backlog" row, hiding the full structure from the swimlane view.

3. **H1 was wasted.** Files had no title. The opportunity to group related rows under a named board
   was lost.

The goal is a single, composable layout primitive: every H2 is a swimlane row, full stop.

## Decision

**H1 headings group related H2 rows into named boards. Every H2 heading is a swimlane row.**

This replaces the `day` / `board` / `bucket` type system with two structural primitives:

| Element | Role |
|---|---|
| `# Heading` | Board — a named group of rows |
| `## Heading` | Row — a swimlane lane with task cards |

### Inference rules

- **H2 heading starts with a day name** (Monday–Sunday) → row is also tagged as a *day row*
  (carries `dayName` and a parsed ISO `date`). Day rows render with day-name labels in the swimlane.
- **All other H2 headings** → plain rows. Name them anything: `Now`, `This Quarter`, `Sprint 1`,
  `Icebox`, `In Review` — they all render as swimlane rows identically.
- **H3+ headings** have no structural significance and are ignored by the parser. They may appear
  in markdown for visual decoration but do not create sub-sections.
- **Files with no H1** produce a single implicit board with an empty heading. All H2 rows belong
  to it. Old-format files continue to parse correctly — only the swimlane display changes (all rows
  visible, non-day rows collapsed by default).

### Updated `BoardData` shape

```typescript
interface Row {
  heading: string;
  dayName?: string;    // set if heading starts with a day name
  date?: string;       // ISO date parsed from day heading
  cards: Card[];
  lineNumber: number;
}

interface Board {
  heading: string;     // H1 heading text; "" for the implicit board
  rows: Row[];
  lineNumber: number;
}

interface BoardData {
  frontmatter: Frontmatter;
  boards: Board[];     // replaces sections[]
}
```

`Card` gains `boardHeading: string` (H1 text, `""` if no H1) and retains `sectionHeading: string`
(H2 text). The `bucketHeading` field is removed.

### Reference file layout

```markdown
---
week: 7
year: 2026
tags: [planner, weekly]
---

# Week 7, 2026

## Monday, February 9, 2026

- [ ] Task A

## Friday, February 13, 2026

- [ ] Task B

# Backlog

## Now

- [ ] Urgent fix

## This Quarter

- [ ] Launch v1.0
```

The swimlane shows all four rows. Day rows (Monday, Friday) are expanded by default; non-day rows
(Now, This Quarter) are collapsed by default. Any row can be dragged to or from.

## Rationale

- **One rule to remember.** H1 = board, H2 = row. No type inference, no special names.
- **Backlog is just another board.** `# Backlog` with `## Now` / `## Next 2 Weeks` / etc. as rows
  is structurally identical to `# Week 7` with day rows. No special-casing required.
- **Full swimlane.** Every H2 in the file is a swimlane row. Users see their full task landscape
  without artificial grouping.
- **Arbitrary structures work.** Sprint boards (`# Sprint 1` / `## In Progress` / `## Done`),
  project boards (`# Deep 13` / `## Experiments`), reading lists — any layout works.
- **Backward compatible in content.** Old files (no H1) parse into an implicit board. All cards
  are preserved. The only behavioral change is that the swimlane now shows all H2 rows rather than
  only day rows.

## Consequences

- `Section`, `Bucket` types are removed from `@hexfield-deck/core`. Consumers update to `Board`,
  `Row`.
- The swimlane view renders all rows from all boards. Non-day rows are collapsed by default.
- The backlog view shows all non-day rows as buckets (regardless of which board they belong to).
- Context menu "Move to" actions are dynamically generated from `boardData.boards[]` — one submenu
  per non-day board, one "Move to Day" submenu for all day rows.
- The `_findSectionInsertionPoint` method in the extension uses the H1 board heading to scope its
  search for the H2 row, enabling disambiguation when the same row heading appears in multiple
  boards.
- H3 headings lose structural significance. Existing files that used H3 sub-sections within a
  Backlog-style section (ADR-0008 `bucket` type) will have those H3s ignored — their cards still
  appear in the enclosing H2 row.
