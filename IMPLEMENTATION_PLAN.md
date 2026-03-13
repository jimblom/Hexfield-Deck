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

Hexfield Deck follows the **H1=Slate / H2=Row model** (ADR-0009). The markdown structure IS the configuration.

### Heading Hierarchy

| Level | Role |
|---|---|
| H1 (`#`) | **Slate** — a named group of rows; selectable in the header dropdown |
| H2 (`##`) | **Row** — a swimlane lane with task cards |
| H3+ | Ignored by the parser (no structural significance) |

Files with no H1 produce a single implicit Slate — old-format files parse correctly.

### Display Aliases

Add `// comment` to an H2 heading to set a short display name:

```markdown
## Monday // February 9, 2026   ← displays as "Monday" in the swimlane
```

### Example File

```markdown
---
type: hexfield-planner
week: 7
year: 2026
---

# Week 7, 2026                        ← Slate

## Monday // February 9, 2026         ← Row (day row; display name "Monday")
- [ ] Morning standup #sol
- [/] Ship parser v1 #hexfield !!!

## Tuesday // February 10, 2026       ← Row
- [ ] Review ADR-0009 #hexfield

# Backlog                             ← another Slate

## Now                                ← Row within Backlog slate
- [ ] Urgent item #hexfield !!

## This Quarter                       ← Row within Backlog slate
- [ ] Q1 objective #hexfield !!!

## Parking Lot                        ← Row within Backlog slate
- [ ] Someday/maybe
```

### Task Status Markers

| Marker | Status | Default board visibility |
|---|---|---|
| `- [ ]` | To Do | ✅ Visible |
| `- [/]` | In Progress | ✅ Visible |
| `- [x]` | Done | ✅ Visible |
| `- [-]` | Won't Do | ❌ Hidden (filter-in only) |
| `- [!]` | Blocked | ❌ Hidden (filter-in only) |

### Task Metadata (inline)

```markdown
- [ ] Task title #project-tag [2026-03-15] !!! est:2h // optional comment
```

| Token | Meaning |
|---|---|
| `#tag-name` | Project tag |
| `[YYYY-MM-DD]` | Due date |
| `!!!` / `!!` / `!` | Priority: High / Medium / Low |
| `est:Xh` / `est:Xm` | Time estimate |
| `// text` | Comment — stripped from title; content not parsed for metadata |

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

### Phase 8: Slates — H1/H2 Layout, Per-Slate Navigation ✅
**Goal:** Replace the day/board/bucket type system with H1=Slate / H2=Row. Add Blocked status and `//` comment syntax.

- [x] `BoardData` shape: `boards: Board[]` replaces `sections: Section[]`; `Board` groups `Row[]`
- [x] Parser: H1 creates Board (Slate), H2 creates Row; H3+ ignored; `[!]` blocked marker; `// comment` stripping in headings and task lines
- [x] `TaskStatus` gains `"wont-do"` and `"blocked"`; both hidden by default
- [x] `displayLabel()` utility: strips ` // ...` from any heading for UI display
- [x] `extractComment()` in metadata pipeline: runs before all other extractors; `Card.comment` stored
- [x] `SlateSelector.tsx`: dropdown/label for H1 Slate navigation in header
- [x] `App.tsx`: `activeSlateIndex` state; Standard and Swimlane views scoped to active Slate; Backlog view removed
- [x] `SwimlaneView.tsx`: accepts single `Board` (active Slate) instead of full `BoardData`
- [x] Context menu: **Move** (within Slate) + **Move to [Slate]** (cross-Slate) structure
- [x] `FilterDropdown`: Blocked added to Status options
- [x] `BoardWebviewPanel.ts`: `[!]` in checkbox maps; `_findSectionInsertionPoint` scopes H2 search within H1 block
- [x] ADR-0009 written; ADR-0008 marked superseded
- [x] `examples/weekly-planner.md` restructured to H1/H2 format with `//` comment demonstrations
- [x] 51 tests passing

---

### Phase 9: Settings & Polish *(next)*
**Goal:** UI cleanup, test coverage, settings documentation, Marketplace submission.

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
| **Week navigation** (◀/▶ buttons, auto-create week files) | Less relevant with Slate model; revisit as workflow plugin. |
| **Obsidian plugin** | Adapt platform layer after v1.0.0 stabilizes. |
| **Card comment display** | `Card.comment` is parsed and stored; rendering (tooltip, inline note) is post-v1.0.0. |
| **PTO / day blackout** | Workflow feature; post-v1.0.0. |
| **Browser preview** | Separate surface; post-v1.0.0. |
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
