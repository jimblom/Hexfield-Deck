# ADR-0006: Line-by-Line Parser over unified/remark

**Status:** Accepted
**Date:** 2026-02-16
**Deciders:** Jim Lindblom
**Tags:** architecture, parser, markdown

## Context

Hexfield Deck needs to parse markdown planner files into structured `BoardData` for rendering as a kanban board. The markdown format is well-constrained and controlled by us:

- YAML frontmatter (flat key-value pairs + one array)
- Heading-delimited sections (`## Day`, `## Backlog`, `### Now`, etc.)
- Checkbox-based tasks (`- [ ]`, `- [x]`, `- [/]`)
- Inline metadata (project tags, due dates, priority markers, time estimates)
- Indented sub-tasks and body content

We need a parser that's fast, dependency-free, and simple to maintain.

**Alternatives considered:**

1. **unified/remark ecosystem** — Full AST-based markdown parser with plugin system
2. **markdown-it** — Fast parser with token stream, plugin architecture
3. **Line-by-line state machine** — Custom parser that processes one line at a time

## Decision

We will use a **line-by-line state machine parser** with no external dependencies.

## Rationale

### Why line-by-line:

**Simplicity:**
- The format is a strict subset of markdown — we don't need general-purpose parsing
- A state machine that tracks "current section" maps directly to our heading structure
- Each line is either a heading, a checkbox, indented content, or ignorable — easy to classify

**Zero dependencies:**
- unified/remark pulls in ~5+ packages (`unified`, `remark-parse`, `remark-frontmatter`, `unist-util-visit`, etc.)
- Our core package stays lean — important for bundling into VS Code and Obsidian extensions
- No transitive dependency risk or version conflicts

**Performance:**
- Single pass over the file, O(n) line count
- No AST construction or tree traversal overhead
- Planner files are small (typically <500 lines), but fast parsing means instant board rendering

**Testability:**
- Each concern is a focused module: frontmatter parsing, metadata extraction, section state machine
- Easy to test each piece in isolation
- Parser behavior is predictable and deterministic

### Why not unified/remark:

**Overhead for our use case:**
- We'd parse the full document into an AST, then walk it to extract the same data we can get line-by-line
- Frontmatter plugin, heading visitor, list-item visitor — all for what's essentially regex + state tracking
- The AST doesn't model our domain (sections, backlog buckets, cards) — we'd still need a transform layer

**Dependency weight:**
- ADR-0004 listed unified/remark as a likely core dependency, but having scoped the actual parsing needs, it's overkill
- Keeping core dependency-free simplifies bundling and reduces attack surface

### Trade-offs accepted:

**Less robust against edge cases:**
- Exotic markdown (nested blockquotes, HTML blocks, reference links inside tasks) won't be handled
- Mitigation: the format is controlled by us. Users write tasks in our format; we don't parse arbitrary markdown.

**Manual maintenance:**
- If the format evolves significantly, we update the state machine
- Mitigation: the format is small and stable. Changes are localized.

## Consequences

### Positive:
- ✅ Zero external dependencies in core parser
- ✅ Single-pass, fast parsing
- ✅ Simple, readable code — easy to onboard contributors
- ✅ Each module (frontmatter, metadata, parser) is independently testable
- ✅ Smaller bundle size for extensions

### Negative:
- ❌ Won't handle arbitrary markdown edge cases gracefully
- ❌ Format changes require manual parser updates (no plugin system)

### Neutral:
- ⚖️ If we ever need full markdown rendering (e.g., rich card bodies), we may add remark for that specific use — but parsing board structure stays line-by-line

## Related ADRs

- [ADR-0004: Monorepo Structure with pnpm Workspaces](0004-monorepo-with-pnpm-workspaces.md)
- [ADR-0005: Checkbox Variant for In-Progress](0005-checkbox-variant-for-in-progress.md)
