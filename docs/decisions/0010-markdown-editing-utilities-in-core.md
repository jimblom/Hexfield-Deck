# ADR-0010: Markdown Editing Utilities in Core

**Status:** Accepted
**Date:** 2026-03-24

## Context

`BoardWebviewPanel.ts` contained four private methods that operate exclusively on arrays of strings (markdown lines) with no VS Code API dependencies:

- `_getCardLineRange` — finds the `[start, end)` line range for a card and its indented children
- `_findEndOfBlock` — finds the insertion point at the end of a heading block
- `_findSectionInsertionPoint` — locates the H2 row insertion point, optionally scoped to an H1 board
- `_rebuildTaskLine` — reconstructs a normalized task line from card fields and overrides

These functions are the core of every write-back operation (move card, edit title, add task, delete task). The Obsidian plugin must perform identical operations using `app.vault.process()` instead of `vscode.WorkspaceEdit`. Without extraction, this logic would be duplicated.

## Decision

Extract the four functions into `packages/core/src/editor/` and export them from the core barrel. `BoardWebviewPanel.ts` imports them from `@hexfield-deck/core` and uses them as module-level functions instead of private methods.

## Rationale

- **Zero platform dependencies.** The functions operate on `string[]` and return numbers or strings. They have no knowledge of VS Code, Obsidian, or any runtime.
- **Testable in isolation.** Moving them to core means they can be Vitest-tested without any extension host scaffolding. 25 unit tests now cover all four functions.
- **No behaviour change.** The implementations are identical — no refactoring of logic, only of location.
- **Enabler for Obsidian.** Both `BoardWebviewPanel.ts` (VS Code) and the forthcoming `HexfieldDeckView.ts` (Obsidian) will import from the same source.

## Consequences

- `packages/core` now has an `editor/` submodule alongside `parser/` and `models/`.
- `BoardWebviewPanel.ts` is ~80 lines shorter.
- Any future platform (CLI, web, Obsidian mobile) gets the editing utilities for free.
