# Hexfield Text — Planning Document

> **Companion VS Code extension that brings Hexfield Deck's visual language into the markdown editor.**

**Issue:** [#12 — Companion VS Code extension for syntax highlighting](https://github.com/jimblom/Hexfield-Deck/issues/12)
**Milestone:** Hexfield Text
**Status:** Planning

---

## Problem Statement

Hexfield Deck metadata — `#project`, `[2026-02-15]`, `!!!`, `est:2h` — renders as
plain text in VS Code's markdown editor. The board view colorizes these elements
richly, but the moment you switch to the source file to edit, that visual language
disappears. Hexfield Text closes that gap by making the editor tab look and feel
like the board.

---

## Goals

- Colorize all Hexfield Deck metadata tokens inline in the editor
- Dynamically color due dates by proximity (overdue → red, today → orange, etc.)
  to match the board's badge colors
- Highlight the three checkbox states (`[ ]`, `[/]`, `[x]`) distinctly
- Activate only on Hexfield Deck planner files (files with `week:` frontmatter)
  so it never interferes with normal markdown files
- Ship as a separate VS Code Marketplace extension, with a recommendation from
  the Hexfield Deck listing

## Non-Goals

- No board rendering — that stays in Hexfield Deck
- No file editing or markdown manipulation
- No Obsidian support (pure VS Code)
- No support for arbitrary markdown files; scope is tightly Hexfield Deck format

---

## Naming

**Hexfield Text** fits the product family convention (Hexfield = the SOL's viewscreen
platform, Text = the editor dimension of that platform). It's distinct enough for
the Marketplace and clearly signals its relationship to Hexfield Deck.

---

## Architecture Decision: TextMate Grammar + Decoration API (Hybrid)

Three approaches were evaluated:

| Approach | Pros | Cons |
|---|---|---|
| **TextMate Grammar only** | Zero runtime cost, instant on load, no API | Static colors only — can't do date-proximity coloring |
| **Decoration API only** | Full dynamic control, date proximity, icon overlays | Activates after load (flicker), more moving parts |
| **Hybrid (recommended)** | Static tokens colored immediately; dynamic dates colored at runtime | Slightly more complexity |

**Recommendation: Hybrid.**

- TextMate grammar handles everything static: `#project-tag`, `!!!`/`!!`/`!`,
  `est:2h`/`est:30m`, `[YYYY-MM-DD]` brackets, `[/]` checkbox variant, frontmatter fields.
- Decoration API handles everything dynamic: coloring due dates by proximity to
  today (overdue, today, soon, future), and any future icon overlays.
- This matches what the VS Code ecosystem recommends (e.g., GitLens uses the same
  pattern: grammar for structure, decorations for live data).

---

## Repository Structure

Hexfield Text will live in a **separate repository** (`hexfield-text`) rather than
as a new package in the Hexfield Deck monorepo. Rationale:

- Independent versioning and release cadence
- Separate Marketplace listing with its own extension ID
- Keeps Hexfield Deck's monorepo focused on the board
- Follows the stated product-family philosophy: focused, themed tools

The new repo will be a straightforward single-package VS Code extension (no monorepo
needed at this scale).

```
hexfield-text/
├── syntaxes/
│   └── hexfield-deck.tmLanguage.json   # TextMate grammar injection
├── src/
│   ├── extension.ts                    # Activation, decorator registration
│   └── decorators/
│       ├── dueDateDecorator.ts         # Dynamic date-proximity coloring
│       └── index.ts
├── package.json                        # Extension manifest
├── tsconfig.json
└── README.md
```

---

## Token Scope Map (TextMate Grammar)

The grammar injects into `text.html.markdown` (VS Code's markdown scope) and
fires only when the document has Hexfield Deck frontmatter. Because TextMate
grammars can't read runtime state, the grammar will colorize all `[YYYY-MM-DD]`
tokens uniformly; the Decoration API will then override colors for date proximity.

| Token | Example | Proposed Scope | Default Color (Dark Theme) |
|---|---|---|---|
| Project tag | `#hexfield` | `entity.name.tag.hexfield` | Blue (#569CD6) |
| Due date bracket | `[2026-02-15]` | `string.quoted.hexfield.date` | Gray (overridden by decorator) |
| Priority HIGH | `!!!` | `keyword.operator.hexfield.priority.high` | Red (#F44747) |
| Priority MED | `!!` | `keyword.operator.hexfield.priority.medium` | Yellow (#CCA700) |
| Priority LOW | `!` | `keyword.operator.hexfield.priority.low` | Green (#89D185) |
| Time estimate | `est:2h` | `constant.numeric.hexfield.estimate` | Teal (#4EC9B0) |
| In-progress checkbox | `[/]` | `markup.changed.hexfield.checkbox` | Orange (#CE9178) |
| Frontmatter key | `week:` `year:` | `keyword.other.hexfield.frontmatter` | Purple (#C586C0) |

---

## Decoration API: Due Date Proximity

The decorator activates when a Hexfield Deck file is opened or becomes active.
It re-runs on every `onDidChangeTextDocument` event (debounced, same 500ms
pattern as Hexfield Deck).

```
Date proximity → decoration color (mirrors board badge colors)
─────────────────────────────────────────────────────────────
Overdue        → Red     (#F44747)
Today          → Orange  (#CE9178)
Within 3 days  → Yellow  (#CCA700)
Future         → Gray    (#858585)
```

The decorator scans for `[YYYY-MM-DD]` patterns, parses the date, computes
proximity relative to today, then applies a `TextEditorDecorationType` with
the appropriate color. This exactly mirrors the board's badge coloring logic.

No dependency on the `@hexfield-deck/core` package is needed — the date
proximity logic is small enough to inline (or extract to a tiny shared utility
if the product family grows).

---

## Implementation Phases

### Phase 1: Repo Bootstrap + Grammar (MVP)

**Goal:** Extension installs, grammar fires, all static tokens are colorized.

- [ ] Create `hexfield-text` GitHub repository
- [ ] Bootstrap VS Code extension scaffold (`yo code` or manual)
- [ ] TypeScript + ESLint + Prettier (match Hexfield Deck conventions)
- [ ] Write `hexfield-deck.tmLanguage.json` injection grammar
  - Inject into `text.html.markdown`
  - Scope: `#project-tag`, `[YYYY-MM-DD]`, `!!!`/`!!`/`!`, `est:Xh`/`est:Xm`, `[/]`
- [ ] Wire grammar in `package.json` (`contributes.grammars`)
- [ ] Manual test against `examples/weekly-planner.md` from Hexfield Deck
- [ ] README with screenshots of before/after

**Deliverable:** Install the `.vsix`, open a planner file, see all metadata tokens colored.

**Acceptance criteria:**
- `#project-tag` tokens are blue
- `!!!`/`!!`/`!` show red/yellow/green
- `est:2h` shows teal
- `[2026-02-15]` shows in a distinct color (gray as default before decorator)
- `[/]` checkbox shows differently from `[ ]` and `[x]`
- Normal markdown files are unaffected

---

### Phase 2: Decoration API — Dynamic Date Colors

**Goal:** Due dates change color based on proximity to today.

- [ ] `extension.ts`: Register activation events (`onLanguage:markdown`)
- [ ] Detect Hexfield Deck files (parse frontmatter for `week:` key)
- [ ] `dueDateDecorator.ts`: Scan document for `[YYYY-MM-DD]` pattern
- [ ] Compute date proximity (overdue / today / within 3 days / future)
- [ ] Create four `TextEditorDecorationType` instances (one per proximity bucket)
- [ ] Apply correct decoration ranges on activation and on document change
  (debounced 500ms)
- [ ] Deactivate decorator on non-Hexfield-Deck files

**Acceptance criteria:**
- `[2026-02-08]` (past) renders red in the editor
- `[<today>]` renders orange
- `[<tomorrow>]` renders yellow
- `[2027-01-01]` renders gray
- Decorations update within 500ms of editing the date

---

### Phase 3: Polish + Marketplace Release

**Goal:** Production-ready, published to VS Code Marketplace.

- [ ] Extension icon (MST3K / Hexfield theme — the Hexfield Viewscreen hex motif)
- [ ] `package.json`: `displayName`, `description`, `categories: ["Linting"]`,
  `keywords: ["markdown", "kanban", "hexfield", "task board"]`
- [ ] `contributes.configuration`: user-configurable token colors (optional
  overrides for each token type)
- [ ] Thorough README with animated GIF showing before/after
- [ ] CHANGELOG.md
- [ ] Publish to VS Code Marketplace via `vsce publish`
- [ ] Open PR on Hexfield Deck to add companion recommendation in its README and
  Marketplace listing

**Acceptance criteria:**
- Extension passes `vsce package` validation
- Extension published to Marketplace under `jimblom.hexfield-text`
- Hexfield Deck README links to Hexfield Text

---

## Open Questions

1. **Checkbox scope**: Should `[/]` get a distinct color purely via grammar, or
   should the decorator also handle `[x]` and `[/]` for richer styling (e.g., a
   strikethrough on done tasks in the editor)? Leaning toward grammar-only for
   checkboxes and keeping the decorator focused on dates only.

2. **Frontmatter activation guard**: TextMate grammars are stateless — they can't
   check frontmatter. The grammar will apply to *all* markdown files. Options:
   - Accept this (colorization in non-planner files is cosmetic and harmless)
   - Use the Decoration API *only* (no grammar) and apply all styling programmatically,
     scoped to Hexfield Deck files
   - Ship the grammar scoped to a custom language ID (`hexfield-markdown`) and add
     a document selector that promotes `.md` files with `week:` frontmatter to that
     language ID

   **Recommended:** Accept the grammar applying to all `.md` files. The tokens
   (`#tag`, `!!!`, `est:2h`) are Hexfield-specific enough that false-positive
   colorization in other markdown files will be rare and unobtrusive.

3. **Monorepo vs separate repo**: Resolved above — separate repo.

4. **Shared date logic with Hexfield Deck core**: The date proximity logic in
   `@hexfield-deck/core` could be extracted to a published npm package
   (`@hexfield/utils`) and consumed by both extensions. Not worth it at this scale;
   inline the logic and revisit if a third tool needs it.

---

## Success Metrics

- Extension installs and activates without errors on a fresh VS Code install
- All five token categories colorized correctly (project, date, priority,
  estimate, in-progress checkbox)
- Due date colors match the board's badge colors exactly (same hex values)
- Zero false-positive colorization on known non-planner markdown files
  (e.g., the Hexfield Deck README itself)
- Published to Marketplace and linked from Hexfield Deck

---

## Dependencies & Notes

- **No runtime dependencies** — grammar is pure JSON, decorator is vanilla VS Code API
- **No dependency on `@hexfield-deck/core`** — keep the extension lightweight
- Minimum VS Code version: 1.75+ (same as Hexfield Deck)
- TypeScript, esbuild for bundling (match Hexfield Deck toolchain)
- Volta for Node version management (match Hexfield Deck)

---

*Last updated: 2026-02-22*
*Author: Claude (planning session `bxVtq`)*
