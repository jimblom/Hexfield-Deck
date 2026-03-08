# Hexfield Deck Implementation Plan

## Overview

This plan outlines the phased development of Hexfield Deck, a markdown-powered kanban task board for VS Code (with future Obsidian support). The goal is to deliver incremental value through focused phases while building toward a production-ready v1.0.0 release.

---

## Architecture

### Monorepo Structure

```
hexfield-deck/
├── packages/
│   ├── core/                      # Shared TypeScript library
│   │   ├── src/
│   │   │   ├── parser/            # Markdown parsing logic
│   │   │   │   ├── frontmatter.ts # YAML frontmatter parsing
│   │   │   │   ├── tasks.ts       # Task/checkbox parsing
│   │   │   │   └── metadata.ts    # Due dates, priority, time estimates
│   │   │   ├── models/            # Data structures
│   │   │   │   ├── Card.ts        # Card interface with metadata
│   │   │   │   ├── BoardData.ts   # Board state
│   │   │   │   └── SubTask.ts     # Sub-task with progress tracking
│   │   │   └── utils/             # Shared utilities
│   │   │       ├── dates.ts       # Week calculations (ISO 8601)
│   │   │       └── markdown.ts    # Markdown manipulation helpers
│   │   └── package.json
│   ├── vscode-extension/          # VS Code extension
│   │   ├── src/
│   │   │   ├── extension.ts       # Extension entry point
│   │   │   ├── commands/          # Command handlers
│   │   │   ├── webview/           # React webview UI
│   │   │   │   ├── components/    # React components
│   │   │   │   │   ├── Board.tsx  # Main board component
│   │   │   │   │   ├── Card.tsx   # Card component
│   │   │   │   │   ├── Column.tsx # Column component
│   │   │   │   │   └── ...
│   │   │   │   ├── views/         # View implementations
│   │   │   │   │   ├── StandardView.tsx
│   │   │   │   │   ├── SwimlaneView.tsx
│   │   │   │   │   └── BacklogView.tsx
│   │   │   │   └── App.tsx        # Root component
│   │   │   └── fileOperations/    # Markdown file manipulation
│   │   └── package.json
│   └── obsidian-plugin/           # Obsidian plugin (post-v1.0.0)
│       ├── src/
│       └── package.json
├── pnpm-workspace.yaml            # Monorepo configuration
├── package.json                   # Root package.json
├── tsconfig.json                  # Shared TypeScript config
└── eslint.config.mjs              # Shared ESLint config
```

### Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Package Manager** | pnpm | Fast, efficient, industry standard for monorepos |
| **Language** | TypeScript | Type safety, required for VS Code and Obsidian |
| **Build Tool** | esbuild | Fast, modern, used by VS Code itself |
| **Markdown Parser** | Custom line-by-line | Zero-dep state machine; format is controlled (see ADR-0006) |
| **Webview UI** | React + TypeScript | Community familiarity, reusable for Obsidian |
| **Drag & Drop** | @dnd-kit | Modern, accessible, actively maintained |
| **Testing** | Vitest | Fast, modern, better DX than Jest |
| **Linting** | ESLint | Industry standard code quality |

### Shared Code Strategy

The `core` package contains the shared foundation:
- Markdown parsing (frontmatter, tasks, metadata extraction)
- Data models (Card, BoardData, Section interfaces)
- Business logic (date utilities, status resolution)
- Markdown manipulation (checkbox toggling, metadata updates)

Platform-specific packages (`vscode-extension`, `obsidian-plugin`) wrap core with platform APIs and render the shared React UI.

---

## File Structure Convention (the published spec)

Hexfield Deck follows a **convention-based section model** (see ADR-0008). The markdown structure IS the configuration. No complex frontmatter is required beyond `type: hexfield-planner`.

### Heading Hierarchy

| Level | Role | Parser behavior |
|---|---|---|
| H1 (`#`) | File/planner title | Ignored by parser |
| H2 (`##`) | Section boundary | Classified by convention |
| H3 (`###`) | Sub-section | Bucket label within a bucket-type section |

### Section Types (inferred from structure)

| H2 pattern | Type | Renders as |
|---|---|---|
| `## {DayName}, ...` | `day` | Row in Swimlane view |
| H2 with H3 sub-headings + tasks | `bucket` | Bucket list (Backlog view) |
| Any other H2 with tasks | `board` | Kanban columns (Standard view) |

### Example File

```markdown
---
type: hexfield-planner
week: 7
year: 2026
---

## Monday, February 9, 2026          ← day section (swimlane row)
- [ ] Morning standup #sol
- [/] Ship parser v1 #hexfield !!!

## Tuesday, February 10, 2026        ← day section
- [ ] Review ADR-0008 #hexfield

## Backlog                            ← bucket section (H3 sub-headings)
### Now
- [ ] Urgent item #hexfield !!

### Next 2 Weeks
- [ ] Coming soon

### This Month
- [ ] Monthly goal

## This Quarter                       ← board section (flat task list)
- [ ] Q1 objective #hexfield !!!

## Parking Lot                        ← board section
- [ ] Someday/maybe
```

### Task Status Markers

| Marker | Status | Default board visibility |
|---|---|---|
| `- [ ]` | To Do | ✅ Visible |
| `- [/]` | In Progress | ✅ Visible |
| `- [x]` | Done | ✅ Visible |
| `- [-]` | Won't Do | ❌ Hidden (filter-in only) |

### Task Metadata (inline)

```markdown
- [ ] Task title #project-tag [2026-03-15] !!! est:2h
```

| Token | Meaning |
|---|---|
| `#tag-name` | Project tag |
| `[YYYY-MM-DD]` | Due date |
| `!!!` / `!!` / `!` | Priority: High / Medium / Low |
| `est:Xh` / `est:Xm` | Time estimate |

---

## Implementation Phases

### Phase 1: Core Foundation ✅
**Goal:** Basic board viewing works

- [x] Monorepo with pnpm workspaces
- [x] TypeScript, ESLint configuration
- [x] Core: frontmatter, task, metadata parsers
- [x] Core: Card, BoardData, SubTask data models
- [x] VS Code extension: activation, command, webview panel
- [x] 3-column board (Todo / In Progress / Done) from markdown

---

### Phase 2: Drag & Drop + Real-Time Sync ✅
**Goal:** Interactive board with markdown sync

- [x] React + TypeScript webview with esbuild
- [x] @dnd-kit drag-and-drop between columns
- [x] `moveCard` message → markdown checkbox toggle
- [x] File watcher for live board refresh

---

### Phase 3: Metadata & Sub-tasks ✅
**Goal:** Full task metadata and sub-task support

- [x] Due dates, priority, time estimate parsing
- [x] Sub-task checkbox parsing and progress calculation
- [x] Color-coded due date, priority, estimate badges
- [x] Interactive sub-task checkboxes with markdown sync

---

### Phase 4: Views & Sorting ✅
**Goal:** Standard, Swimlane, and Backlog views with sorting

- [x] View switcher toolbar
- [x] Standard view (3-column kanban, all tasks)
- [x] Swimlane view (day rows × status columns, collapsible)
- [x] Backlog view (priority bucket rows)
- [x] Sort by file order, priority, status, project, estimate
- [x] Cross-day and cross-bucket drag-and-drop

---

### Phase 5: Context Menu & CRUD ✅
**Goal:** Full task management via right-click

- [x] Right-click context menu with flyout submenus
- [x] Edit title, due date, time estimate, priority, status
- [x] Move to day, move to backlog section
- [x] Delete with confirmation
- [x] Quick Add (+) toolbar button
- [x] `_rebuildTaskLine()` normalizes metadata order on all edits

---

### Phase 6: Inline Markdown Rendering ✅
**Goal:** Bold, italic, links, code in card titles

- [x] `marked` inline parser in `MarkdownTitle.tsx`
- [x] Link interception → `vscode.env.openExternal()`
- [x] Consistent rendering across all three views

---

### Phase 7: Metadata Filtering ✅
**Goal:** Filter by project, status, priority, due date, estimate

- [x] `FilterDropdown.tsx` with five filter dimensions
- [x] AND across dimensions, OR within dimension
- [x] Active filter count badge, "Clear all" button
- [x] Filters apply across all views and persist on view switch

---

### Phase 8: Generic Section Model *(next)*
**Goal:** Refactor `BoardData` and parser to a convention-based, generic section model (ADR-0008). Foundation for all v1.0.0 features.

**Core changes:**

- [ ] Redefine `BoardData` — replace named fields (`days`, `backlog`, `thisQuarter`, etc.) with `sections: Section[]`
- [ ] New `Section` type with `type: 'day' | 'board' | 'bucket'`, `heading`, `cards`, and optional `buckets`
- [ ] Refactor parser to classify H2 sections by convention (day name pattern → `day`; H3 sub-sections present → `bucket`; else → `board`)
- [ ] Add `[-]` as fourth status (`wont-do`) in the checkbox map and `TaskStatus` type
- [ ] Update `allCards()` utility and all core exports
- [ ] Update all parser unit tests to new shape
- [ ] Confirm existing planner files parse identically under the new model

**Deliverable:** `packages/core` produces a generic `BoardData` with `sections[]`. Parser tests pass. Existing weekly planner files parse correctly with no behavior change visible to the user.

**Acceptance Criteria:**
- [ ] `BoardData.days`, `backlog`, `thisQuarter`, `thisYear`, `parkingLot` removed; replaced by `sections[]`
- [ ] Weekly planner example file parses to correct section types (`day`, `bucket`, `board`)
- [ ] `- [-]` checkbox parses to `status: 'wont-do'`
- [ ] All existing core tests pass (updated to new shape)
- [ ] No regressions in the VS Code extension (views may temporarily consume an adapter layer)

---

### Phase 9: Flexible Views
**Goal:** All three views consume the generic section model. Swimlane rows and board columns are no longer hardcoded.

**Standard view:**
- [ ] Columns = one per active status (currently 3; extensible to N)
- [ ] All `board` and `day` section cards displayed together across columns

**Swimlane view:**
- [ ] Rows = all sections (any H2), not just day-name headings
- [ ] Each row gets status columns
- [ ] Row label = section heading (day name, "Backlog", "Sprint 1", whatever)
- [ ] Collapsible rows retained

**Backlog view:**
- [ ] Driven by `bucket`-type sections and their H3 sub-buckets
- [ ] Any `bucket` section (not just `## Backlog`) renders here
- [ ] Falls back gracefully when no bucket sections exist

**Won't Do:**
- [ ] `wont-do` cards hidden from all views by default
- [ ] Status filter gains "Won't Do" option to surface them (dimmed, strikethrough title)
- [ ] Context menu "Change State" submenu includes Won't Do

**Drag & drop:**
- [ ] Cross-section drag in Swimlane updates the markdown section correctly for arbitrary sections (not just day names)

**Deliverable:** All three views work correctly with the generic section model. Won't Do is fully wired.

**Acceptance Criteria:**
- [ ] Standard view shows all active cards across columns
- [ ] Swimlane view renders a row for every H2 section in the file
- [ ] Backlog view renders any `bucket`-type section, not just `## Backlog`
- [ ] Won't Do cards are hidden by default; surfaced via Status filter
- [ ] Drag-and-drop works correctly across arbitrary sections
- [ ] Existing weekly planner files behave identically to pre-refactor (no regressions)

---

### Phase 10: Polish & v1.0.0
**Goal:** UI cleanup, test coverage, documentation, Marketplace submission.

**UI polish:**
- [ ] Consistent spacing, typography, and icon usage across all views
- [ ] Empty state illustrations (no tasks, no sections)
- [ ] Loading/parsing state (avoid flash of empty board)
- [ ] Extension icon and Marketplace banner image

**Settings:**
- [ ] `hexfield-deck.defaultView` (standard / swimlane / backlog)
- [ ] `hexfield-deck.autoCollapseSections` (boolean)
- [ ] Review and document all existing `hexfield-deck.*` settings in USER_GUIDE

**Testing:**
- [ ] Core package unit tests: >80% coverage
- [ ] Parser tests cover all section types and edge cases
- [ ] Integration tests for key extension commands

**Documentation:**
- [ ] USER_GUIDE updated with new section model, Won't Do, all views
- [ ] README updated with current screenshots
- [ ] File format spec documented (the published convention)

**Marketplace:**
- [ ] Extension passes VS Code Marketplace validation
- [ ] `vsce package` clean (no warnings)
- [ ] Marketplace listing copy written

**Deliverable:** v1.0.0 published to VS Code Marketplace.

**Acceptance Criteria:**
- [ ] Extension published and installable from Marketplace
- [ ] Zero open critical bugs
- [ ] Core package >80% test coverage
- [ ] USER_GUIDE complete and accurate
- [ ] All settings documented

---

### Post-v1.0.0 Backlog

Features intentionally descoped from v1.0.0:

| Feature | Notes |
|---|---|
| **Week navigation** (◀/▶ buttons, auto-create week files) | PR #13 on hold. Less relevant with generic section model; revisit as workflow plugin. |
| **Obsidian plugin** | Requires generic model (Phase 8) first; then adapt platform layer. |
| **Multi-planner files** (H1 as planner boundary) | H2 is the unit for v1.0.0; H1 boundary is a natural extension. |
| **PTO / day blackout** (issue #16) | Workflow feature; post-v1.0.0. |
| **Plan title standard** (issue #15) | Nice-to-have; post-v1.0.0. |
| **Browser preview** (issue #9) | Separate surface; post-v1.0.0. |
| **Filter UX improvements** (issue #11) | Refinement; post-v1.0.0. |

---

## Decisions Made

1. ✅ **Heading structure:** H2 headings are the structural unit; section type inferred by convention (ADR-0008)
2. ✅ **Project specification:** Inline `#tags` only; bold text headers ignored by parser
3. ✅ **In-progress marker:** `- [/]` only
4. ✅ **Won't Do marker:** `- [-]`; hidden by default, filter-in only (issue #20)
5. ✅ **Parser approach:** Line-by-line state machine, zero deps (ADR-0006)
6. ✅ **Drag-and-drop library:** @dnd-kit
7. ✅ **Configuration namespace:** `hexfield.colors.*` owned by Hexfield Text (ADR-0007)
8. ✅ **Week navigation:** Descoped to post-v1.0.0
9. ✅ **No frontmatter section declarations:** Convention is the spec (ADR-0008)

---

**Last Updated:** 2026-03-07
**Status:** ✅ Phases 1–7 complete | 🚀 Phase 8 next — Generic Section Model
