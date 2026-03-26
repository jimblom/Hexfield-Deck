# ADR-0011: HostBridge — TypeScript Interface as Platform Abstraction for Webview UI

**Status:** Accepted
**Date:** 2026-03-26

## Context

Phase 10 adds Obsidian support. The existing `App.tsx` called `acquireVsCodeApi()` unconditionally at module level, coupling it permanently to VS Code's webview runtime. Obsidian renders React directly into `contentEl` with no `acquireVsCodeApi` shim — the existing component tree simply cannot load in Obsidian without modification.

Since a refactor was unavoidable, the goal was to make it clean: components should have no knowledge of the host platform.

## Decision

Introduce a `HostBridge` TypeScript interface as the sole contract between UI components and the host platform:

```typescript
interface HostBridge {
  send(message: OutboundMessage): void;
  onUpdate(handler: (payload: UpdatePayload) => void): () => void;
  getState(): HostState | null;
  setState(state: HostState): void;
}
```

`OutboundMessage` is a discriminated union of the 12 existing message types — this is a rename, not a redesign. `UpdatePayload` is the existing board update shape.

Two concrete implementations:
- **`VsCodeBridge`** — wraps `acquireVsCodeApi()`, lives in `packages/webview-ui`
- **`ObsidianBridge`** — uses `app.vault.process()` and Obsidian Modals, lives in `packages/obsidian-plugin`

`App.tsx` receives `bridge` as a required prop. All `vscode.postMessage(...)` calls become `bridge.send(...)`, all `window.addEventListener("message", ...)` become `bridge.onUpdate(...)`, and all `vscode.getState()` / `vscode.setState()` delegate to `bridge`.

All React components (`Board.tsx`, `Card.tsx`, `SwimlaneView.tsx`, etc.) and `styles.css` are moved from `packages/vscode-extension/src/webview/` to a new shared package `packages/webview-ui` (`@hexfield-deck/webview-ui`). Both VS Code and Obsidian consume this package.

## Rationale

- **Minimal diff**: The `OutboundMessage` union is structurally identical to the existing message protocol. No component logic changes — only the delivery mechanism is abstracted.
- **Testability**: Components can be tested with a mock bridge implementation without a host environment.
- **Single source of truth**: Both platforms render the same React tree. Visual regressions on one platform are caught by the other.
- **No alternatives needed**: Duplicating the component tree per platform would double maintenance cost. Direct Obsidian API calls inside components would make them untestable and tightly coupled.

## Consequences

- The `bridge` prop is required — callers must instantiate the correct bridge before rendering `<App>`.
- `VsCodeBridge` must be imported by `vscode-extension/src/webview/index.tsx` (entry point), keeping `acquireVsCodeApi()` out of components entirely.
- Adding a new host platform in the future requires only a new `HostBridge` implementation — no component changes.
- `packages/webview-ui` has no build step; it is consumed as TypeScript source and bundled by each platform's own build tooling (esbuild for VS Code, esbuild for Obsidian).
