# Hexfield Deck

## Project Overview

Hexfield Deck is a markdown-powered task board for VS Code and Obsidian. Parse your markdown files into an interactive kanban board — drag cards across columns, set due dates, apply tags, and manage your workflow without ever leaving your editor. Your notes, your board, your deck.

- **Author:** Jim Lindblom (jimblom)
- **License:** MIT
- **Repo:** git@github.com:jimblom/Hexfield-Deck.git
- **Platforms:** VS Code extension, Obsidian plugin

## Naming & Theme

The name "Hexfield Deck" is an MST3K (Mystery Science Theater 3000) reference:

- **Hexfield** — The Hexfield Viewscreen on the Satellite of Love, the ship's visual display/communication screen.
- **Deck** — Triple meaning: the command deck of the SOL (where the viewscreen lives), a deck of cards (kanban boards use cards), and the general "flight deck" connotation of command and oversight.

The broader product line may follow an MST3K theme — either SOL components or movie titles from episodes. Some names held in reserve for future tools:

| Concept | Candidate Name | MST3K Reference |
|---------|---------------|-----------------|
| Time tracking | Time Chasers | Ep #821 |
| Secrets/config | Code Name: Diamond Head | Ep #608 |
| Diff/change tool | Quest of the Delta Knights | Ep #913 |
| Task runner | Hobgoblins | Ep #907 |
| Profiler | Overdrawn at the Memory Bank | Ep #822 |
| Snapshots | Jack Frost | Ep #813 |

## Origin

This is a clean-room reimagining of a VS Code extension the author built internally at work ("MD Taskboard") to replace a OneNote-based workflow. This public version is a hard fork of the concept, designed from scratch for broader use and dual-platform support (VS Code + Obsidian).

## Development Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Core parser + basic board render | ✅ Complete |
| 2 | Drag-and-drop between columns | ✅ Complete |
| 3 | Due dates, priorities, time estimates | ✅ Complete |
| 4 | Swimlane + Backlog views | ✅ Complete |
| 5 | Right-click context menu, CRUD ops, Quick Add | ✅ Complete |
| 6 | Inline markdown rendering, link interception | ✅ Complete |
| 7 | Metadata filtering (project/status/priority/date/estimate) | ✅ Complete |
| 8 | Generic section model (H1 board / H2 row), wont-do status | ✅ Complete |
| 9 | Polish & VS Code Marketplace submission (v1.0.0) | ✅ Complete |
| 10 | Obsidian plugin — full feature parity | ✅ Complete |

Current release: **v1.0.0** on `main` (targeting). Branch: `feature/phase-10-obsidian`.

ADRs 0001–0014 in `docs/decisions/`.

## Technical Decisions

- **Monorepo:** `packages/core/` (TypeScript, compiled with `tsc`) + `packages/vscode-extension/` (esbuild dual build: extension as CJS, webview as IIFE)
- **Package manager:** pnpm with workspaces (ADR-0002)
- **Node version:** Managed by Volta (ADR-0001)
- **Drag and drop:** `@dnd-kit` (ADR-0003)
- **Webview UI:** React 19, bundled into `dist/webview.js` by esbuild
- **Testing:** Vitest — tests live in `packages/core/`
- **Linting:** ESLint 9 pinned (typescript-eslint not yet compatible with ESLint 10)
- **Parser:** Line-by-line; preserves `lineNumber` on every card for write-back (ADR-0006)
- **Section model:** Convention-based — heading text determines type (day/bucket/board); no explicit markers (ADR-0008, ADR-0009)
- **In-progress status:** `[/]` checkbox variant (ADR-0005)
- **Webview ↔ extension:** Message-passing with ready handshake (webview sends `"ready"`, extension waits before sending board data)
- **Metadata order on write-back:** `title [project] [date] !!! est:Xh #tag` — normalized by `rebuildTaskLine()`

## Conventions

- **Branching:** Feature branches → PRs → merge to `main`
- **ADRs:** Capture significant architectural decisions in `docs/decisions/` following the existing numbered format (Status / Date / Context / Decision / Rationale / Consequences)
- **Phases:** Features are grouped into numbered phases with a plan doc in `docs/` before implementation begins
- **CI:** GitHub Actions — lint → build → test → `vsce package` artifact (`.github/workflows/ci.yml`)
