# ADR-0013: Optional H2 Headings — Implicit Default Row

**Status:** Accepted
**Date:** 2026-04-18
**Deciders:** Jim Lindblom
**Amends:** ADR-0009 (H1 Board / H2 Row Layout Convention)

## Context

ADR-0009 established H1 = board ("slate") and H2 = row (swimlane lane) as the two structural
primitives. In practice, every card must live under an H2 heading — the parser's `flushCard()`
silently drops cards when `currentRow` is null, which happens whenever a task line appears under
an H1 with no preceding H2.

Real-world daily planner files (weekly overviews, meeting journals) often have sections where tasks
sit directly under an H1 heading with no natural H2 subdivision. Users are forced to add dummy H2
headings (e.g. `## L2`) just to make the parser pick up their cards. This adds friction to the
markdown authoring workflow, especially in Obsidian where quick capture matters.

## Decision

**H2 headings are optional. When cards appear under an H1 with no preceding H2, the parser creates
an implicit default row with `heading: ""`.**

### Parser behavior

A new `ensureRow()` function (mirroring the existing `ensureBoard()`) is called when the checkbox
handler encounters a task line with no `currentRow`. It:

1. Calls `ensureBoard()` to guarantee a board exists
2. Creates a row with `heading: ""` and `lineNumber` matching the board's
3. Inserts it at the front of `board.rows[]` via `unshift` (document order: orphan cards come first)
4. Sets `currentRow` to the new implicit row

`flushCard()` is unchanged — `currentRow` is now always non-null when `pendingCard` is non-null.

### Insertion point

`findSectionInsertionPoint(lines, sectionHeading, boardHeading)` gains a special case:
when `sectionHeading === ""`, it targets the area between the H1 heading and the first H2
(or the end of the board if no H2 exists).

### Rendering

- **Board view (standard):** No change — already merges all cards by status.
- **Swimlane view:** The implicit row appears at the top of the lane grid with the label
  "General". It is expanded by default (never auto-collapsed).
- **Context menu "Move to":** The implicit row appears as "General" in the submenu.

### Write operations

Falsy guards on `sectionHeading` (which reject `""`) are changed from `!sectionHeading` to
`sectionHeading == null` in both the Obsidian and VS Code bridges.

## Rationale

- **Matches real-world usage.** Daily journals and weekly overviews often have flat task lists
  under an H1 with no meaningful H2 subdivision.
- **Mirrors `ensureBoard()` pattern.** The codebase already handles implicit boards for files
  with no H1. Implicit rows are the same idea, one level down.
- **Backward compatible.** Files with H2s parse identically — `ensureRow()` is only called when
  `currentRow` is null and a checkbox is encountered. No implicit rows are created if every card
  already has an H2 parent.

## Consequences

- The implicit row is invisible in the markdown source — it exists only in the parsed model.
- `Card.sectionHeading` can be `""` for cards in the implicit row. Consumers must handle this.
- `displayLabel("")` returns `""`, so UI components check for empty heading and substitute
  "General" as the display label.
- Quick Add targets the implicit row when no other rows exist in the slate.
