# Changelog

All notable changes to Hexfield Deck are documented here.

---

## [Unreleased]

### Changed

- **Projects removed — tags promoted** — The `[project-name]` bracket syntax is no longer a supported metadata field. Tags (`#tag`) are now the sole organizational label. Per-tag color configuration (color, border/fill style, priority list) replaces the old per-project color system. Existing files with `[project]` tokens display clean titles — the bracket text is stripped from the rendered card without modifying the file.

---

## [1.0.0] — 2026-05-09

### Added

- **Obsidian plugin** — Full feature parity with the VS Code extension. Open any markdown board file from Obsidian's ribbon or command palette. Drag-and-drop, context menus, filters, search, quick add, jump-to-source, sub-task checkboxes, and tag color configuration all work identically. Context menus use Obsidian's native `Menu` API with checkmarks for current priority and state.

- **Tag pill badges** — `#tags` are rendered as oval pill badges on a separate row below date/priority badges. Tags no longer show a `#` prefix on the card. Each tag supports an individually configured color; the card's accent color (left border or fill) is driven by the first tag in a user-defined priority list.

- **"All Slates" selector** — A new option in the Slate dropdown shows cards from all H1 Slates combined in a single board view.

- **Wikilink rendering in Obsidian** — `[[Note Name]]` links in card titles are rendered as clickable links that navigate to the referenced note.

- **Optional H2 headings** — Tasks can appear directly under an H1 Slate with no preceding H2. They are collected into an implicit default row and appear in the "General" column.

### Fixed

- **Obsidian CSS variable mappings** — Corrected mappings for dropdown and input background variables in Obsidian's design system.

- **Obsidian slate selector** — The slate selector dropdown now renders correctly in all Obsidian themes.

---

## [0.8.0] — 2026-03-24

### Added

- **Click card → jump to source** — Clicking a card body opens the markdown file and places the cursor on that task's line. Right-click still opens the context menu without navigating.

- **Today row auto-expand** — In Swimlane view, today's day row opens automatically on load. All other day rows start collapsed. Non-day rows (e.g. `## Now`, `## Backlog`) are unaffected.

- **Overdue card border** — Cards with a past due date show a red top border in addition to the existing red date badge, making overdue work visible at a glance without reading badge text.

- **Comment display** — Task comments (the ` // note` suffix) now appear as a small italic line beneath the card title on the board. Previously comments were parsed and stored but never shown.

- **Search bar** — A text input in the toolbar filters cards by title substring in real time. Applies on top of any active metadata filters. Clears when switching Slates.

- **Slate progress indicator** — The header shows `X / Y done` and a progress bar for the active Slate. Won't Do and Blocked cards are excluded from the count.

- **Column card counts** — Standard view column headers now show a card count badge (e.g. `To Do (8)`).

- **Status bar item** — While a board is open, the VS Code status bar shows the active filename (`tasks.md — Hexfield Deck`). Disappears when the panel closes.

- **Empty states** — Two cases that previously showed a blank board now show helpful prompts:
  - *No tasks in this Slate* — prompt to add a task with `+` or open the file
  - *Filters hide all cards* — prompt with a "clear all filters" link

### Fixed

- **Swimlane grid with Blocked / Won't Do columns** — The swimlane CSS grid template was hardcoded to 3 status columns. When Blocked or Won't Do cards were present, the additional columns broke the layout. The grid is now computed from the actual column count.

---

## [0.6.1] — 2026-03-07

### Fixed

- **Project clear button (✕)** — Clicking ✕ in the color picker now correctly clears
  the color and style, retaining only the URL if one was set. Previously the button had
  no effect due to a spread bug that re-wrote the unchanged config.

- **Project URL input** — URL values now save reliably. Previously, clicking outside the
  panel closed it before the `blur` event fired, silently discarding any typed URL.

---

## [0.6.0] — 2026-02-28

### Added

- **Project color selector panel** — New "Projects" button in the toolbar (left of Filter)
  opens a popover listing every `#project` tag discovered in the active file. Per-project
  controls include:
  - Color dot → 12-swatch curated palette (matches Hexfield Text token colors) + native
    color wheel for custom hex + clear button
  - Style dropdown: **Border** (3px left stripe), **Fill** (~10% opacity background tint),
    or **Both**
  - URL input: makes the project badge a clickable link (opens in browser via existing
    link interception)
  - Changes write to `hexfield-deck.projects` in global VS Code settings immediately,
    with optimistic UI update for instant visual feedback

- **Card color styles** — `hexfield-deck.projects` entries now support a `style` field
  (`"border"` | `"fill"` | `"both"`). Default remains `"border"` for backwards
  compatibility with existing configurations.

- **Configurable badge colors** — All metadata badge colors (project tags, priorities,
  due dates, time estimates) now read from `hexfield.colors.*` VS Code settings rather
  than hardcoded VS Code theme variables. Colors stay in sync with Hexfield Text when
  both extensions are installed.

- **Hexfield Text compatibility** — Hexfield Deck now accepts files promoted to the
  `hexfield-markdown` language ID by the Hexfield Text companion extension. Context
  menu entries and the `openBoard` command guard both recognize `hexfield-markdown`
  alongside `markdown`.

- **`type: hexfield-planner` frontmatter field** — Documented as the canonical file
  identity signal for all Hexfield-family extensions. Added to examples, USER_GUIDE,
  and the week template generator.

- **Hexfield ecosystem spec** — `docs/hexfield-ecosystem.md` documents the shared
  contracts between Hexfield extensions: file identity, language ID, configuration
  namespace ownership, CSS variable names, and the shared color palette. Intended as
  the integration reference for Hexfield Text and future family members.

### Changed

- `hexfield.colors.*` configuration properties removed from Hexfield Deck's
  `package.json` — Hexfield Text owns this namespace (see ADR-0007). Hexfield Deck
  reads the values at runtime with hardcoded fallback defaults; standalone behavior
  is unchanged.

- `contributes.configuration` title updated from `"Hexfield"` to `"Hexfield Deck"`.

### Architecture

- ADR-0007: Hexfield Text owns the `hexfield.colors.*` configuration namespace

---

## [0.5.0] — 2026-02-14

### Added

- **Metadata filtering** — Filter cards by project, status, priority, due date bucket,
  and time estimate; AND logic across dimensions, OR within; active filter count badge
  in toolbar

---

## [0.4.0] — 2026-02-13

### Added

- **Swimlane view** — Day-of-week rows × status columns; cross-day drag-and-drop
- **Backlog view** — Priority buckets (Now / Next 2 Weeks / This Month / This Quarter /
  This Year / Parking Lot) with drag between sections
- **Card sorting** — Sort by file order, priority, status, project, or estimate
- **Right-click context menu** — Edit title, due date, time estimate, priority, status;
  delete task; open in markdown
- **Quick Add** — `+` toolbar button inserts a task into today's section
- **Open in Markdown** — Jump to a card's source line from the board
- **Inline markdown rendering** — Bold, italic, strikethrough, code spans, and links
  in card titles and sub-task text

---

## [0.3.0] — 2026-02-12

### Added

- Sub-task progress bars and checklist visualization
- Interactive sub-task checkbox cycling (To Do → In Progress → Done)
- Color-coded due date badges (overdue / today / soon / future)

---

## [0.2.0] — 2026-02-11

### Added

- Drag-and-drop between kanban columns with live markdown sync
- View persistence across panel show/hide

---

## [0.1.0] — 2026-02-10

### Added

- Initial release: 3-column kanban board from markdown planner files
- Live sync on document change
- Metadata badges: project, due date, priority, time estimate
- Native VS Code theming
