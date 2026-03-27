# ADR-0012: Obsidian Plugin — ItemView + vault.process Architecture

**Status:** Accepted
**Date:** 2026-03-26

## Context

Phase 10C introduces the Hexfield Deck Obsidian plugin. Obsidian offers two broad rendering models for custom content:
1. **Markdown post-processors** — decorations over the existing editor; not suitable for a full kanban board.
2. **Custom views via `ItemView`** — a first-class workspace pane with a DOM root; suitable for rich interactive UIs.

File I/O in Obsidian is governed by the vault API, which differs from VS Code's `TextDocument` / `WorkspaceEdit` model.

## Decision

### View layer
`HexfieldDeckView extends ItemView` is the container. It:
- Injects bundled CSS from `@hexfield-deck/webview-ui` as a `<style>` tag at runtime (same "CSS as text" pattern used by the VS Code extension — no separate CSS build step needed for Phase 10C).
- Mounts the React tree (`<App bridge={bridge}/>`) into `contentEl`.
- Delegates initial load and re-load on file save to `ObsidianBridge` via the "ready" callback.
- Persists state (open file path) via `getState()` / `setState()` so Obsidian can restore the view across workspace reloads.

### File I/O
- **Read:** `app.vault.read(tfile)` → split by `\n` → `parseBoard` + `allCards` from `@hexfield-deck/core`.
- **Watch:** `app.vault.on("modify", ...)` registered via `registerEvent` (auto-cleaned up on view close).
- **Write (Phase 10D):** `app.vault.process(tfile, fn)` — atomic read-modify-write using the same editing functions from `@hexfield-deck/core`.

### "Ready" handshake
`App.tsx` follows a ready-handshake pattern (`bridge.send({ type: "ready" })`) inherited from the VS Code implementation. `ObsidianBridge` intercepts the "ready" message and fires a callback registered by `HexfieldDeckView`, which then calls `_load()`. This preserves the existing App contract without modification.

### Plugin registration
`HexfieldDeckPlugin extends Plugin` registers the view type, adds a command palette entry ("Open as Hexfield Deck"), and adds a file-explorer / editor-tab right-click menu item via `workspace.on("file-menu")`. The view is opened in a new tab with `getLeaf("tab")` and state passed via `setViewState`.

### Package layout
- `packages/obsidian-plugin/` — new package in the monorepo; picked up by the existing `pnpm-workspace.yaml` glob.
- `esbuild.config.mjs` bundles `src/main.ts` → `main.js` (CJS for Obsidian's loader). Externals: `obsidian`, `electron`, all `@codemirror/*` and `@lezer/*` (provided by Obsidian).
- `manifest.json` declares plugin metadata; `styles.css` contains layout overrides.

## Rationale

- **ItemView over WebviewPanel:** Obsidian has no iframe-based webview API like VS Code. `ItemView` provides a direct DOM root in the same renderer process, which actually gives us more layout flexibility and removes CSP constraints — allowing CSS animations in Phase 10E.
- **CSS injection at runtime:** Avoids a separate CSS build step and keeps the component library self-contained in `@hexfield-deck/webview-ui`.
- **Shared React tree:** Zero code duplication with VS Code — same `App`, `Board`, `SwimlaneView`, etc. Platform differences are entirely inside `ObsidianBridge`.

## Consequences

- Phase 10D must fill in `ObsidianBridge.send()` handlers for all 12 message types (move, edit, delete, etc.) using `vault.process()` and Obsidian `Modal`.
- The plugin is desktop-only compatible with `minAppVersion: "1.0.0"` for now; mobile would need additional testing.
- Bundle size is ~1.3 MB (production) — large but consistent with VS Code webview; acceptable for a desktop plugin.
