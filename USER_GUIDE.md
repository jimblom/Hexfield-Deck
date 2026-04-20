# Hexfield Deck User Guide

Complete reference for the markdown file format and features supported by Hexfield Deck.

---

## Quick Start

Hexfield Deck turns structured markdown files into interactive kanban boards. Here's the minimal format:

```markdown
---
type: hexfield-planner
week: 1
year: 2026
tags: [planner, weekly]
---

# Week 1, 2026

## Monday, February 2, 2026

- [ ] My first task #project-1
- [/] Task in progress #project2
- [x] Completed task #another-project
```

Open this file in VS Code, run **Hexfield Deck: Open Board**, and see your tasks as cards.

---

## File Structure

### Frontmatter

Every file must start with YAML frontmatter:

```yaml
---
type: hexfield-planner          # Hexfield product identifier (required)
week: 1                         # Week number (required)
year: 2026                      # Year (required)
tags: [planner, weekly]         # Tags array (required)
startDate: 2026-02-05           # Optional: Slate start date
endDate: 2026-02-09             # Optional: Slate end date
---
```

**Required fields:** `type`, `week`, `year`, `tags`

### Heading Hierarchy — Slates and Rows

Hexfield Deck uses two structural primitives:

| Element | Role |
|---------|------|
| `# Heading` | **Slate** — a named group of rows (e.g. `# Week 7`, `# Backlog`) |
| `## Heading` | **Row** — a swimlane lane with task cards (e.g. `## Monday`, `## Now`) |

H3+ headings have no structural significance and are ignored by the parser.

```markdown
# Week 7, 2026          ← Slate: selectable in the header dropdown

## Monday               ← Row: appears as a swimlane lane
- [ ] Task A

## Tuesday              ← Row: another swimlane lane
- [ ] Task B

# Backlog               ← Another Slate

## Now                  ← Row within the Backlog slate
- [ ] Urgent item

## This Quarter         ← Row within the Backlog slate
- [ ] Quarterly goal
```

**Files with no H1 heading** produce a single implicit Slate. Old-format files continue to parse correctly.

**H2 headings are optional.** Tasks can appear directly under an H1 heading with no H2:

```markdown
# My Board

- [ ] Task directly under the slate
- [/] Another task — no H2 needed
```

In swimlane view, these tasks appear in a **"General"** row at the top of the lane grid. In standard view, they merge into the status columns as usual.

When a Slate has both direct tasks and H2 rows, the direct tasks appear in the General row above the named rows:

```markdown
# Sprint 5

- [ ] Unorganized task       ← General row
- [ ] Another loose task     ← General row

## In Progress               ← Named row

- [/] Organized task
```

### Display Aliases with `//`

Add a `//` comment to an H2 heading to set a short display name for the swimlane label:

```markdown
## Monday // February 9, 2026
```

The swimlane shows **"Monday"**; the full date is preserved in the markdown source. Without `//`, the full heading text is used as-is.

---

## Tasks

### Checkbox States

All five states are recognized:

| Markdown | Status | Display |
|----------|--------|---------|
| `- [ ]` | **To Do** | Default unchecked state |
| `- [/]` | **In Progress** | Actively being worked on |
| `- [x]` | **Done** | Completed |
| `- [-]` | **Won't Do** | Cancelled — hidden by default |
| `- [!]` | **Blocked** | Waiting on something — hidden by default |

**Won't Do and Blocked** are hidden from the board by default. Use the Status filter to make them visible.

**Important:** Use `- [ ]` with a space inside the brackets, not `- []` or `-[]`.

### Task Body and Sub-Tasks

Add details by indenting content below a task:

```markdown
- [ ] Main task #project
  Freeform note line — displayed as body text on the card
  - [ ] Sub-task 1
  - [x] Sub-task 2 (completed)
  - [ ] Sub-task 3
```

- **Body lines:** Plain indented text displayed as a note on the card
- **Sub-task checkboxes:** Clickable — toggle through To Do → In Progress → Done directly on the card
- **Progress tracking:** Sub-task completion shown as a count (e.g. "1/3 subtasks")

### Comments

Add a `//` comment to any task line to annotate it without affecting the title display:

```markdown
- [ ] Fix the escape pod hatch #sol !! est:1h // keeps jamming since the Pumaman screening
- [!] Restock supplies // waiting on shuttle from Gizmonic
```

The comment text (after ` // `) is stripped from the displayed card title and shown as a small italic note beneath the title on the card. Tags, dates, and other metadata inside a comment are **not** parsed — `// #tag` inside a comment does not create a project tag.

**URL safety:** The separator requires a leading space (` // `), so `https://example.com` is never accidentally treated as a comment.

### Metadata

Enhance tasks with inline metadata. Metadata can appear in any order after the title.

#### Due Dates

```markdown
- [ ] Task with due date [2026-02-15]
- [ ] Task with due date due:2026-02-15
```

**Format:** `YYYY-MM-DD` (ISO 8601)

**Display:** Color-coded badge, and overdue cards additionally show a red top border on the card itself:
- Overdue: Red badge + red card border
- Today: Orange
- Due within 7 days: Yellow
- Future: Gray

#### Priority

```markdown
- [ ] High priority task !!!
- [ ] Medium priority task !!
- [ ] Low priority task !
```

**Display:** Colored badge — HIGH (red), MED (yellow), LOW (green)

#### Time Estimates

```markdown
- [ ] Task with estimate est:2h
- [ ] Short task est:30m
```

**Display:** Badge showing the estimate (e.g. `2h`)

#### Project Tags

```markdown
- [ ] Task belongs to Hexfield project #hexfield
- [ ] Task belongs to Deep 13 lab #deep13
```

The `#` must be preceded by a space. A `#` inside a URL (`https://example.com/page#section`) is treated as a URL fragment, not a project tag.

#### Combining Metadata

All metadata can be combined in one line:

```markdown
- [/] Ship **parser v1** #hexfield [2026-02-10] !!! est:4h // nearly there
  - [/] Write frontmatter tests
  - [x] Wire up barrel exports
  - [ ] Final review
```

**This task has:** project (hexfield), due date (Feb 10), high priority, 4h estimate, a comment, and three sub-tasks.

### Inline Markdown Formatting

Card and sub-task titles support inline markdown:

| Syntax | Renders as |
|--------|-----------|
| `**text**` or `__text__` | **Bold** |
| `*text*` or `_text_` | *Italic* |
| `~~text~~` | ~~Strikethrough~~ |
| `` `text` `` | `Code span` |
| `[label](url)` | Clickable link (opens in browser) |

---

## Views

The board header shows a **Slate selector** dropdown (when the file has multiple H1 sections), a **progress indicator**, and two view buttons: **Standard** and **Swimlane**. The active Slate and view are persisted across panel reloads.

When a Slate has no tasks, or when active filters hide all cards, the board shows a contextual empty state with a prompt to add tasks or clear filters.

### Slate Selector

Navigate between H1 Slates using the dropdown in the header. Each Slate shows only its own H2 rows in the view. The dropdown is replaced by a plain label when there is only one Slate in the file.

### Standard View

All task cards from the active Slate across three columns. Each column header shows a card count:

```
┌──────────────┐  ┌─────────────┐  ┌─────────────┐
│  To Do  (8)  │  │ In Progress │  │  Done  (12) │
│              │  │    (3)      │  │             │
│  All rows    │  │  All rows   │  │  All rows   │
└──────────────┘  └─────────────┘  └─────────────┘
```

### Swimlane View

Each H2 row in the active Slate becomes a horizontal lane with its own To Do / In Progress / Done columns:

```
▼ Monday (5 tasks)       ← today: auto-expanded
  ┌─────────┐  ┌─────────────┐  ┌──────┐
  │  To Do  │  │ In Progress │  │ Done │
  └─────────┘  └─────────────┘  └──────┘

▶ Tuesday (3 tasks)      ← collapsed
▶ Wednesday (2 tasks)    ← collapsed
```

- **General row** — tasks directly under H1 with no H2 — is always expanded
- **Today's day row** is automatically expanded on load; all other day rows start collapsed
- **Non-day rows** (e.g. `## Now`, `## Backlog`) are always collapsed by default
- Click the triangle to toggle any row

---

## Drag & Drop

### Standard View

Drag a card between columns to update its status:

| From → To | Markdown change |
|-----------|----------------|
| To Do → In Progress | `[ ]` → `[/]` |
| In Progress → Done | `[/]` → `[x]` |
| Done → To Do | `[x]` → `[ ]` |

### Swimlane View

Drag within a row to change status, or drag to a different row to move the card to that section and optionally change status simultaneously.

---

## Jump to Source

Click any card to jump directly to its source line in the markdown file. The editor opens the file, places the cursor on the task, and centers the view.

To click without jumping (e.g. when using the context menu), right-click instead.

---

## Context Menu

Right-click any card:

| Option | Description |
|--------|-------------|
| **Open in Markdown** | Jump to the task's source line in the file |
| **Edit Title...** | Change the task title |
| **Edit Due Date...** | Set or clear due date |
| **Edit Time Estimate...** | Set or clear time estimate |
| **Set Priority** | Submenu: High, Medium, Low, None |
| **Change State** | Submenu: To Do, In Progress, Done, Won't Do, Blocked |
| **Move** | Move to any row within the same Slate |
| **Move to [Slate]** | Move to a row in a different Slate (one submenu per other Slate) |
| **Delete Task...** | Remove the task from the markdown file |

---

## Search

A search bar in the toolbar lets you filter cards by title text. Type any substring to narrow the board to matching cards across all rows. The search clears when you switch Slates.

- Click **✕** (or clear the input) to restore all cards
- Search runs after any active metadata filters — both are applied together

---

## Slate Progress

The header shows completion progress for the active Slate next to the Slate selector:

```
[Week 7, 2026 ▼]    7 / 23 done  ████░░░░░░
```

The fraction and bar count cards with **Done** status against all active cards. Won't Do and Blocked cards are excluded from both numerator and denominator — they don't count as remaining work.

---

## Filtering & Sorting

### Metadata Filtering

Click the **Filter** button in the toolbar. Conditions are AND'd between dimensions and OR'd within each dimension.

| Dimension | Options |
|-----------|---------|
| **Project** | Any project tag present in the file (multi-select) |
| **Status** | To Do, In Progress, Done, Won't Do, Blocked |
| **Priority** | High, Medium, Low |
| **Due Date** | Overdue, Due Today, Due This Week, No Due Date |
| **Time Estimate** | Short (≤30m), Medium (30m–2h), Long (2h+), No Estimate |

The Filter button shows a count badge when filters are active. **Won't Do** and **Blocked** cards are hidden by default and only appear when explicitly selected in the Status filter.

### Sort Options

Available in all views via the sort bar:

- **File order** — Default; preserves markdown file order
- **Priority** — High → Medium → Low → None
- **Status** — In Progress → To Do → Done
- **Project** — Alphabetical
- **Estimate** — Longest first

---

## Quick Add

Click the **+** button in the toolbar to insert a new task:

- If the active Slate contains today's day row, the task is added there
- Otherwise, the first day row in the active Slate is used
- If no day rows exist, the first row of the active Slate is used

---

## Status Bar

While a Hexfield Deck board is open, the VS Code status bar shows the active file:

```
$(symbol-misc) tasks.md — Hexfield Deck
```

The item disappears when the board panel is closed.

---

## Live Sync

The board automatically refreshes as you edit the markdown file — no manual save required. Changes appear within 500ms of typing.

**The markdown file is the source of truth.** All board operations (drag, move, edit) write back to the file immediately.

**Dirty file indicator:** If the file has unsaved changes, a `● Unsaved changes` label appears in the header.

---

## Complete Example

```markdown
---
type: hexfield-planner
week: 7
year: 2026
tags: [planner, weekly]
startDate: 2026-02-09
endDate: 2026-02-15
---

# Week 7, 2026

## Monday // February 9, 2026

- [x] Morning standup #deep13
- [/] Fix viewscreen glitch #hexfield [2026-02-09] !! est:2h // viewport calc was off
  - [x] Reproduce the issue
  - [ ] Write regression test
- [!] Coordinate with Gizmonic #deep13 // waiting on Dr. Forrester's approval

## Tuesday // February 10, 2026

- [ ] Ship parser v1 #hexfield [2026-02-10] !!! est:4h
- [x] File expense report due:2026-02-10

# Backlog

## Now

- [ ] Fix escape pod hatch #sol !! est:1h // keeps jamming
- [ ] Add Obsidian plugin scaffold #hexfield

## This Quarter

- [ ] Launch Hexfield Deck v1.0 #hexfield [2026-03-31] !!!

## Parking Lot

- [-] Rewrite everything in Rust // not happening
```

---

## Rules & Behavior

### What Gets Parsed

- **Any H1 heading** → creates a Slate
- **Any H2 heading** → creates a Row within the current Slate
- **H3+ headings** → ignored (no structural significance)
- **Files without H1** → all H2 rows go into a single implicit Slate

### Metadata Parsing Order

Comment is stripped first, then metadata is extracted from the remainder:

```markdown
- [ ] Task #hexfield [2026-02-10] !!!   ← works
- [ ] Task !!! [2026-02-10] #hexfield   ← also works (order-independent)
- [ ] Task #hexfield // #ignore-me      ← #ignore-me is inside the comment, not a tag
```

First match wins for each field (e.g. first date found is used if two dates appear).

### File Modifications

| Board action | Markdown change |
|--------------|----------------|
| Drag to Done | `[ ]` or `[/]` → `[x]` |
| Drag to In Progress | `[ ]` or `[x]` → `[/]` |
| Drag to To Do | `[x]` or `[/]` → `[ ]` |
| Change State → Won't Do | any → `[-]` |
| Change State → Blocked | any → `[!]` |
| Toggle sub-task | cycles `[ ]` → `[/]` → `[x]` → `[ ]` |
| Move to row | Moves task block to target H2 section |
| Edit metadata | Updates the task line in place |
| Quick Add | Inserts `- [ ] New Task` at end of target row |

---

## Troubleshooting

### Cards not appearing?

✅ Frontmatter has `week`, `year`, `tags`
✅ Tasks are under an H1 or H2 heading (H2 is optional)
✅ Checkbox format is `- [ ]` with a space

### Won't Do / Blocked cards invisible?

✅ These statuses are hidden by default — open **Filter → Status** and check **Won't Do** or **Blocked**

### Metadata not showing?

✅ Date format is `YYYY-MM-DD`
✅ Priority uses `!!!`, `!!`, or `!`
✅ Estimate format is `2h` or `30m`
✅ Check that metadata isn't inside a `// comment`

### Drag & drop not working?

✅ Refresh the board
✅ Check VS Code file watcher isn't disabled
✅ Ensure the file isn't read-only

---

## Version History

| Version | Highlights |
|---------|-----------|
| **v0.8.0** | Click card to jump to source; today row auto-expand in Swimlane; overdue card border; comment display on cards; search bar; Slate progress indicator; column card counts; status bar item; empty states |
| **v0.7.0** | H1=Slate / H2=Row layout (ADR-0009); per-Slate navigation dropdown; Blocked status (`[!]`); `//` comment syntax for headings and tasks |
| **v0.6.0** | Project color selector panel; Hexfield Text compatibility for badge colors |
| **v0.5.0** | Metadata filtering — project, status, priority, due date, time estimate |
| **v0.4.0** | Inline markdown rendering in card and sub-task titles |
| **v0.3.0** | Right-click context menu, CRUD editing, Quick Add button |
| **v0.2.x** | Multiple views (Swimlane, Backlog), card sorting, view persistence |
| **v0.1.x** | Core parser, 3-column board, drag-and-drop, sub-task checkboxes |

---

## Related Documentation

- [README.md](README.md) — Project overview and quick start
- [Architecture Decisions](docs/decisions/) — Technical ADRs
