# Architectural Decision Records

This directory contains records of architectural decisions made during the development of Hexfield Deck.

## What is an ADR?

An Architectural Decision Record (ADR) documents a significant decision made during development, including:
- The context and problem being addressed
- The decision that was made
- The rationale behind the decision
- The consequences (positive, negative, and neutral)

ADRs are **immutable** - if a decision changes, we create a new ADR that supersedes the old one.

## Format

Each ADR follows this structure:
- **Status:** Proposed | Accepted | Deprecated | Superseded
- **Date:** When the decision was made
- **Deciders:** Who made the decision
- **Context:** What problem are we solving?
- **Decision:** What did we decide?
- **Rationale:** Why did we make this decision?
- **Consequences:** What are the positive, negative, and neutral outcomes?
- **Resources:** Links to relevant documentation
- **Follow-up Study:** Topics to explore deeper

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-use-volta-for-node-version-management.md) | Use Volta for Node.js Version Management | Accepted | 2026-02-13 |
| [0002](0002-use-pnpm-for-package-management.md) | Use pnpm for Package Management | Accepted | 2026-02-13 |
| [0003](0003-use-dnd-kit-for-drag-and-drop.md) | Use @dnd-kit for Drag and Drop | Accepted | 2026-02-13 |
| [0004](0004-monorepo-with-pnpm-workspaces.md) | Monorepo Structure with pnpm Workspaces | Accepted | 2026-02-13 |
| [0005](0005-checkbox-variant-for-in-progress.md) | Use [/] Checkbox Variant for In-Progress Status | Accepted | 2026-02-13 |

---

**Template for new ADRs:** Copy `0001-use-volta-for-node-version-management.md` and update the content.
