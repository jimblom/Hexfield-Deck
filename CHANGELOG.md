# Changelog

All notable changes to Hexfield Deck are documented here.

---

## [0.6.0] — 2026-03-07

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

### Fixed

- **Project clear button (✕)** — Clicking ✕ in the color picker now correctly clears
  the color and style, retaining only the URL if one was set. Previously the button had
  no effect due to a spread bug that re-wrote the unchanged config.

- **Project URL input** — URL values now save reliably. Previously, clicking outside the
  panel closed it before the `blur` event fired, silently discarding any typed URL.

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
