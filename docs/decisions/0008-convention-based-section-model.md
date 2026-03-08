# ADR-0008: Convention-Based Section Model (H2 as Structural Unit)

**Status:** Accepted
**Date:** 2026-03-07
**Deciders:** Jim Lindblom

## Context

The current parser has a hardcoded structural model. It recognizes a fixed set
of heading patterns — day names, `## Backlog`, `## This Quarter`, etc. — and
maps them to specific fields in a rigid `BoardData` type:

```typescript
interface BoardData {
  frontmatter: Frontmatter;
  days: DaySection[];       // hardcoded
  backlog: BacklogBucket[]; // hardcoded
  thisQuarter: Card[];      // hardcoded
  thisYear: Card[];         // hardcoded
  parkingLot: Card[];       // hardcoded
}
```

This works for weekly planner files that follow the assumed layout, but it
prevents the tool from supporting:

- Arbitrary swimlane dimensions (e.g., projects, epics, sprints — not just days)
- Custom status markers beyond `[ ]` / `[/]` / `[x]`
- Additional columns / statuses per workflow
- Non-weekly planner structures (project boards, sprint boards, etc.)

The question was how to make the model generic without burdening users with
explicit configuration.

## Decision

**H2 headings (`##`) are the primary structural unit of a Hexfield planner
file. Section type and rendering behavior are inferred from heading text
according to published naming conventions — no frontmatter declarations are
required.**

The naming conventions ARE the spec. The parser reads the document structure
and classifies sections automatically, following the same philosophy as Marp:
the markdown structure itself is the configuration.

### Inference Rules (the published spec)

| Heading pattern | Inferred type | Rendering |
|---|---|---|
| `## {DayName}, ...` | `day` | Swimlane row |
| Any H2 with H3 sub-headings and tasks | `bucket` | Bucket list (backlog-style) |
| Any other H2 with tasks | `board` | Kanban columns |

**H3 headings** serve as sub-structure within a section (e.g., bucket names
inside a `## Backlog` or `## Icebox` section). Any H2 can have H3 sub-sections
and be treated as a bucket list — the heading does not need to be named
"Backlog".

**H1 headings** are reserved as a planner title / ignored by the parser.
Multiple H1 sections as a "multi-planner" boundary is a post-v1.0.0
consideration.

### Generic `BoardData` Shape

`BoardData` becomes section-first:

```typescript
interface Section {
  heading: string;
  type: 'day' | 'board' | 'bucket';
  cards: Card[];           // direct cards (for 'day' and 'board' types)
  buckets?: Bucket[];      // sub-sections (for 'bucket' type)
  lineNumber: number;
}

interface BoardData {
  frontmatter: Frontmatter;
  sections: Section[];
}
```

All views consume `sections[]` rather than named fields.

### Status Markers

Status markers are extended to support a configurable map. The default map
ships with four statuses:

| Marker | Status | Default visibility |
|---|---|---|
| `[ ]` | `todo` | Visible |
| `[/]` | `in-progress` | Visible |
| `[x]` | `done` | Visible |
| `[-]` | `wont-do` | Hidden (filter-in only) |

The status map is the mechanism through which additional statuses and columns
can be introduced in the future, but the four defaults cover v1.0.0.

## Rationale

- **No frontmatter bloat.** `type: hexfield-planner` remains the only required
  signal. The document structure communicates everything else.
- **Existing files just work.** The inference rules cover all patterns in the
  current weekly planner format. No migration needed.
- **Novel layouts work by convention.** A sprint board, a project board, or any
  other structure works as long as it follows the published H2 convention. The
  user writes markdown; the tool figures out the rest.
- **Marp principle.** Configuration through structure rather than configuration
  through configuration.

## Consequences

- `BoardData` in `packages/core` must be redesigned from named fields to
  `sections[]`. This is a breaking change to the core API — all consumers
  (views, extension handlers, tests) update together.
- The parser becomes a generic section classifier rather than a pattern matcher
  for a fixed layout.
- All three views (Standard, Swimlane, Backlog) are refactored to consume
  `sections[]` instead of typed fields. Views become projections over the
  generic section model rather than specialized renderers for fixed structures.
- Week navigation (Phase 8 of the original plan) is descoped to post-v1.0.0.
  The tool is no longer opinionated about weekly file structure, making
  week-to-week navigation a workflow-specific concern rather than a core feature.
- The inference rules are a public contract. Changes to them are breaking
  changes and require a new ADR.
