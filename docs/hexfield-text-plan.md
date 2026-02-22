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
- Activate **only** on Hexfield product files — identified by a `type:` frontmatter
  field — so it never interferes with normal markdown files
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

## Frontmatter File Identity Field

Hexfield Deck is early enough that we can enforce a canonical product identifier
in frontmatter. All Hexfield planner files will require a `type:` field:

```yaml
---
type: hexfield-planner    # ← canonical Hexfield product identifier
week: 1
year: 2026
tags: [planner, weekly]
start_date: 2026-02-05
end_date: 2026-02-09
---
```

**Why `type: hexfield-planner`:**
- Self-documenting — any tool or human reading the file knows its purpose
- Scales across the product family (`hexfield-timechaser`, etc. if future tools
  have their own file formats)
- Simple to check in code: `frontmatter.type === 'hexfield-planner'`
- Follows a well-established convention (static site generators, Matter.js, etc.)

**Hexfield Deck changes required:**
- Add `type: hexfield-planner` to the week template generator (`generateWeekTemplate()`)
- Update the frontmatter detection logic: check `type === 'hexfield-planner'` as
  the primary signal (alongside or replacing the current `week:` + `year:` + `tags:` heuristic)
- Update USER_GUIDE.md to document `type:` as a required frontmatter field
- Existing files without `type:` continue to work via the current heuristic;
  `type:` becomes required for new files

---

## Architecture Decision: Custom Language ID + Hybrid Grammar/Decoration

Three approaches were evaluated for scoping colorization to Hexfield files only:

| Approach | Pros | Cons |
|---|---|---|
| **Grammar on all `.md` files** | Simple | False positives; `!!!` colors non-Hexfield markdown |
| **Decoration API only** | Perfectly scoped to Hexfield files | All colorization deferred to runtime; slight load flicker |
| **Custom language ID (recommended)** | Grammar scoped precisely; decorations scoped precisely; no false positives | Small runtime cost to promote language on file open |

**Recommendation: Custom language ID (`hexfield-markdown`) + Hybrid grammar/decoration.**

When a `.md` file is opened, the extension reads its frontmatter. If
`type: hexfield-planner` is found, it calls:

```typescript
vscode.languages.setTextDocumentLanguage(document, 'hexfield-markdown');
```

This promotes the file to the `hexfield-markdown` language ID. From that point:

- The **TextMate grammar** is contributed for `hexfield-markdown` only — it never
  touches regular markdown files
- The **Decoration API** uses a `{ language: 'hexfield-markdown' }` document
  selector — it also never activates on regular markdown
- VS Code's built-in markdown features (preview, folding) are inherited via the
  grammar's `embeddedLanguages` and `baseLanguage` declarations

**TextMate grammar** handles everything static: `#project-tag`, `!!!`/`!!`/`!`,
`est:2h`/`est:30m`, `[YYYY-MM-DD]` brackets, `[/]` checkbox variant, frontmatter keys.

**Decoration API** handles the one dynamic element: due date proximity coloring,
which requires knowing today's date at runtime.

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

The grammar contributes to the `hexfield-markdown` language ID only (not
`text.html.markdown`). It fires only on files that have been promoted via
the `type: hexfield-planner` frontmatter check. Because TextMate grammars
can't read runtime state, the grammar colorizes all `[YYYY-MM-DD]` tokens
uniformly; the Decoration API then overrides colors for date proximity.

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

### Phase 1: Repo Bootstrap + Language ID Promotion + Grammar (MVP)

**Goal:** Extension installs, promotes Hexfield files to `hexfield-markdown`,
grammar fires, all static tokens are colorized.

- [ ] Create `hexfield-text` GitHub repository
- [ ] Bootstrap VS Code extension scaffold (`yo code` or manual)
- [ ] TypeScript + ESLint + Prettier (match Hexfield Deck conventions)
- [ ] `package.json`: Declare `hexfield-markdown` language (`contributes.languages`)
  with `extends: "markdown"` so built-in markdown features are inherited
- [ ] `extension.ts`: On `onDidOpenTextDocument` and `onDidChangeActiveTextEditor`,
  read frontmatter, check `type === 'hexfield-planner'`, call
  `setTextDocumentLanguage(doc, 'hexfield-markdown')`
- [ ] Write `hexfield-deck.tmLanguage.json` grammar scoped to `hexfield-markdown`
  - Scope: `#project-tag`, `[YYYY-MM-DD]`, `!!!`/`!!`/`!`, `est:Xh`/`est:Xm`, `[/]`
- [ ] Wire grammar in `package.json` (`contributes.grammars`)
- [ ] **Hexfield Deck side:** Add `type: hexfield-planner` to `generateWeekTemplate()`
  and update detection heuristic; update USER_GUIDE.md
- [ ] Manual test: open existing example file (without `type:`) → no colorization;
  add `type: hexfield-planner` → colorization activates immediately
- [ ] README with before/after screenshots

**Deliverable:** Install the `.vsix`, open a Hexfield planner file, see all metadata
tokens colored. Open a regular markdown file — no effect.

**Acceptance criteria:**
- `#project-tag` tokens are blue in Hexfield files only
- `!!!`/`!!`/`!` show red/yellow/green in Hexfield files only
- `est:2h` shows teal
- `[2026-02-15]` shows in a distinct default color
- `[/]` checkbox shows differently from `[ ]` and `[x]`
- Regular `.md` files (README, notes) are completely unaffected
- Removing `type: hexfield-planner` from frontmatter deactivates colorization

---

### Phase 2: Decoration API — Dynamic Date Colors

**Goal:** Due dates change color based on proximity to today.

- [ ] `extension.ts`: Register activation events (`onLanguage:hexfield-markdown`)
- [ ] Document selector scoped to `{ language: 'hexfield-markdown' }` — no
  frontmatter re-checking needed; language promotion in Phase 1 handles this
- [ ] `dueDateDecorator.ts`: Scan document for `[YYYY-MM-DD]` pattern
- [ ] Compute date proximity (overdue / today / within 3 days / future)
- [ ] Create four `TextEditorDecorationType` instances (one per proximity bucket)
- [ ] Apply correct decoration ranges on activation and on document change
  (debounced 500ms)

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

2. **~~Frontmatter activation guard~~** ✅ Resolved — Custom language ID
   (`hexfield-markdown`) promoted via `setTextDocumentLanguage()` on files with
   `type: hexfield-planner` frontmatter. Grammar and decorations scope to
   `hexfield-markdown` only. No false positives on regular markdown files.

3. **Monorepo vs separate repo**: Resolved — separate repo.

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

*Last updated: 2026-02-22 (rev 2 — custom language ID + `type:` frontmatter field)*
*Author: Claude (planning session `bxVtq`)*
