# ADR-0014: Native Obsidian Menu for Context Menu

**Status:** Accepted
**Date:** 2026-05-09
**Deciders:** Jim Lindblom

## Context

The React webview (`packages/webview-ui`) ships a `ContextMenu.tsx` component that renders a
floating overlay using `position: fixed`. In VS Code's WebviewPanel, this is the right approach:
the webview runs in an isolated iframe, so fixed positioning is relative to the webview viewport
and z-index conflicts with VS Code's UI don't exist.

Obsidian renders the same React app inside a standard DOM `ItemView` (`contentEl`), not an iframe.
Fixed positioning in this context is anchored to the _nearest containing block with a CSS
transform_ — and Obsidian's pane layout applies `transform` (or `will-change: transform`) to
leaf containers for split-pane animations and resize. This means `position: fixed` elements are
confined to the pane's bounding box, causing the context menu to appear at incorrect coordinates
or clip against pane edges. Adjusting z-index cannot fix this root cause.

## Decision

Use Obsidian's native `Menu` / `MenuItem` API for context menus in the Obsidian plugin, rather
than the React `ContextMenu.tsx` component.

**Implementation:** An optional `onContextMenu` prop was added to `App.tsx`. When provided, the
`openContextMenu` callback delegates to the prop and returns early, so `contextMenu` state is
never set and the React `<ContextMenu>` never mounts. `HexfieldDeckView.tsx` passes this prop,
building and showing an Obsidian `Menu` via `_buildContextMenu()` / `_handleContextMenu()`.

The native menu uses `addSeparator()` for section breaks and `MenuItem.setChecked()` to indicate
the current Priority and State — a visual improvement over the React implementation which has no
checkmarks. Move submenus are rendered as flat items (`Move: [section]`,
`Move to [Board]: [section]`) since `MenuItem.setSubmenu()` is not in the typed Obsidian API
(v1.7.2).

All action handlers (`_editTitle`, `_setPriority`, `_moveCard`, `_moveCardToSection`,
`_deleteTask`, etc.) already existed in `ObsidianBridge` — no new backend logic was required.
`_lastBoardData` was added to `ObsidianBridge` and populated on every `pushUpdate()` so that
Move items can enumerate board sections without a separate data fetch.

## Rationale

- **Correctness:** Native `Menu` uses Obsidian's own z-index layer system and handles
  viewport-edge clamping automatically. No CSS fighting required.
- **Platform consistency:** Obsidian users expect the platform's native context menu look. The
  React overlay is VS Code–flavored and inconsistent with Obsidian themes.
- **Minimal coupling:** The `onContextMenu` prop is optional with no default — VS Code behavior
  is completely unaffected. The bridge interface (`HostBridge`) is unchanged.
- **No new backend logic:** All ObsidianBridge handlers were already implemented (ADR-0011).

## Consequences

- Obsidian context menus are flat (no nested hover-submenus for Priority/State) due to API
  constraints. This is a visual trade-off; all actions remain accessible.
- If Obsidian adds typed `setSubmenu()` support in a future release, `_buildContextMenu()` can
  be upgraded to nested submenus without any changes outside `HexfieldDeckView.tsx`.
- The React `ContextMenu.tsx` and its CSS remain in `webview-ui` for VS Code. Dead CSS
  (`.context-menu-*` rules) is injected into the Obsidian pane but is harmless since the
  component never mounts.
