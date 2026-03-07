# Hexfield Text — Implementation Plan

> Companion VS Code extension that brings Hexfield Deck's visual language into the markdown editor.

**Related:** [Hexfield Deck — Issue #12](https://github.com/jimblom/Hexfield-Deck/issues/12)
**Status:** Phase 1 in progress

---

## Problem Statement

Hexfield Deck metadata — `#project`, `[2026-02-15]`, `!!!`, `est:2h` — renders as plain text in VS Code's markdown editor. The board view colorizes these elements richly, but the moment you switch to the source file to edit, that visual language disappears. Hexfield Text closes that gap by making the editor tab look and feel like the board.

---

## Goals

- Colorize all Hexfield Deck metadata tokens inline in the editor
- Dynamically color due dates by proximity (overdue → red, today → orange, etc.) to match the board's badge colors exactly
- Highlight the three checkbox states (`[ ]`, `[/]`, `[x]`) distinctly
- Activate **only** on Hexfield product files — identified by `type: hexfield-planner` frontmatter — so it never interferes with normal markdown files
- Ship as a separate VS Code Marketplace extension, with a recommendation from the Hexfield Deck listing

## Non-Goals

- No board rendering — that stays in Hexfield Deck
- No file editing or markdown manipulation
- No Obsidian support (pure VS Code)
- No support for arbitrary markdown files; scope is tightly Hexfield Deck format

---

## Architecture Decision: Custom Language ID + Hybrid Grammar/Decoration

Three approaches were evaluated for scoping colorization to Hexfield files only:

| Approach | Pros | Cons |
|---|---|---|
| **Grammar on all `.md` files** | Simple | False positives; `!!!` colors non-Hexfield markdown |
| **Decoration API only** | Perfectly scoped to Hexfield files | All colorization deferred to runtime; slight load flicker |
| **Custom language ID** (chosen) | Grammar scoped precisely; decorations scoped precisely; no false positives | Small runtime cost to promote language on file open |

**Decision: Custom language ID (`hexfield-markdown`) + Hybrid grammar/decoration.**

When a `.md` file is opened, the extension reads its frontmatter. If `type: hexfield-planner` is found, it calls:

```typescript
vscode.languages.setTextDocumentLanguage(document, 'hexfield-markdown');
```

This promotes the file to the `hexfield-markdown` language ID. From that point:

- The **TextMate grammar** is contributed for `hexfield-markdown` only — it never touches regular markdown files
- The **Decoration API** uses a `{ language: 'hexfield-markdown' }` document selector — it also never activates on regular markdown
- VS Code's built-in markdown features (preview, folding, link detection) are preserved via `embeddedLanguages` and a `baseLanguage` declaration in the grammar

**TextMate grammar** handles everything static: `#project-tag`, `!!!`/`!!`/`!`, `est:2h`/`est:30m`, `[YYYY-MM-DD]` brackets (default color only), `[/]` checkbox variant, frontmatter keys.

**Decoration API** handles the one dynamic element: due date proximity coloring, which requires knowing today's date at runtime.

---

## Repository Structure

```
hexfield-text/
├── syntaxes/
│   └── hexfield-deck.tmLanguage.json   # TextMate grammar for hexfield-markdown
├── src/
│   ├── extension.ts                    # Activation, language promotion, decorator registration
│   └── decorators/
│       ├── dueDateDecorator.ts         # Dynamic date-proximity colorization
│       └── index.ts
├── package.json                        # Extension manifest
├── tsconfig.json
├── README.md
├── USER_GUIDE.md
└── IMPLEMENTATION_PLAN.md
```

---

## Token Scope Map (TextMate Grammar)

The grammar contributes to the `hexfield-markdown` language ID only (not `text.html.markdown`). It fires only on files that have been promoted via the `type: hexfield-planner` frontmatter check. Because TextMate grammars can't read runtime state, the grammar colorizes all `[YYYY-MM-DD]` tokens with a uniform default color; the Decoration API then overrides them with proximity-based colors.

| Token | Example | Proposed Scope | Default Color (Dark Theme) |
|---|---|---|---|
| Project tag | `#hexfield` | `entity.name.tag.hexfield` | Blue (`#569CD6`) |
| Due date bracket | `[2026-02-15]` | `string.quoted.hexfield.date` | Gray (overridden by decorator) |
| Priority HIGH | `!!!` | `keyword.operator.hexfield.priority.high` | Red (`#F44747`) |
| Priority MED | `!!` | `keyword.operator.hexfield.priority.medium` | Yellow (`#CCA700`) |
| Priority LOW | `!` | `keyword.operator.hexfield.priority.low` | Green (`#89D185`) |
| Time estimate | `est:2h` | `constant.numeric.hexfield.estimate` | Teal (`#4EC9B0`) |
| In-progress checkbox | `[/]` | `markup.changed.hexfield.checkbox` | Orange (`#CE9178`) |
| Frontmatter key | `week:` `year:` `type:` | `keyword.other.hexfield.frontmatter` | Purple (`#C586C0`) |

---

## Decoration API: Due Date Proximity

The decorator activates when a Hexfield Deck file is opened or becomes the active editor. It re-runs on every `onDidChangeTextDocument` event (debounced, 500ms — same pattern as Hexfield Deck's board sync).

```
Date proximity → decoration color (mirrors board badge colors exactly)
─────────────────────────────────────────────────────────────────────
Overdue (date < today)   → Red     (#F44747)
Today                    → Orange  (#CE9178)
Within 3 days            → Yellow  (#CCA700)
Future                   → Gray    (#858585)
```

The decorator scans for `[YYYY-MM-DD]` patterns, parses the date, computes proximity relative to today, then applies a `TextEditorDecorationType` with the appropriate color. This exactly mirrors the board's badge coloring logic.

No dependency on `@hexfield-deck/core` is needed — the date proximity logic is small enough to inline.

---

## Implementation Phases

### Phase 1: Repo Bootstrap + Language ID Promotion + Grammar (MVP)

**Goal:** Extension installs, promotes Hexfield files to `hexfield-markdown`, grammar fires, all static tokens are colorized.

- [ ] Bootstrap VS Code extension scaffold (manual or `yo code`)
- [ ] TypeScript + ESLint + Prettier (match Hexfield Deck conventions)
- [ ] `package.json`: Declare `hexfield-markdown` language (`contributes.languages`) with `extends: "markdown"` so built-in markdown features are inherited
- [ ] `extension.ts`: On `onDidOpenTextDocument` and `onDidChangeActiveTextEditor`, read frontmatter, check `type === 'hexfield-planner'`, call `setTextDocumentLanguage(doc, 'hexfield-markdown')`
- [ ] Write `hexfield-deck.tmLanguage.json` grammar scoped to `hexfield-markdown`
  - Scope: `#project-tag`, `[YYYY-MM-DD]`, `!!!`/`!!`/`!`, `est:Xh`/`est:Xm`, `[/]`, frontmatter keys
- [ ] Wire grammar in `package.json` (`contributes.grammars`)
- [ ] Manual test: open existing example file (without `type:`) → no colorization; add `type: hexfield-planner` → colorization activates immediately
- [ ] README with before/after screenshots (placeholder OK for initial Marketplace listing)

**Acceptance criteria:**
- `#project-tag` tokens are blue in Hexfield files only
- `!!!`/`!!`/`!` show red/yellow/green in Hexfield files only
- `est:2h` shows teal
- `[2026-02-15]` shows in a distinct default gray color
- `[/]` checkbox shows differently from `[ ]` and `[x]`
- Regular `.md` files (README, notes) are completely unaffected
- Removing `type: hexfield-planner` from frontmatter deactivates colorization

---

### Phase 2: Decoration API — Dynamic Date Colors

**Goal:** Due dates change color based on proximity to today.

- [ ] `extension.ts`: Register activation events (`onLanguage:hexfield-markdown`)
- [ ] Document selector scoped to `{ language: 'hexfield-markdown' }` — language promotion in Phase 1 handles the filtering, no frontmatter re-checking needed here
- [ ] `dueDateDecorator.ts`: Scan document for `[YYYY-MM-DD]` pattern
- [ ] Compute date proximity (overdue / today / within 3 days / future)
- [ ] Create four `TextEditorDecorationType` instances (one per proximity bucket)
- [ ] Apply correct decoration ranges on activation and on document change (debounced 500ms)

**Acceptance criteria:**
- A past date renders red
- Today's date renders orange
- A date 1–3 days from now renders yellow
- A far-future date renders gray
- Decorations update within 500ms of editing the date

---

### Phase 3: Polish + Marketplace Release

**Goal:** Production-ready, published to VS Code Marketplace.

- [ ] Extension icon (Hexfield theme — the Hexfield Viewscreen hex motif)
- [ ] `package.json`: `displayName`, `description`, `categories: ["Other"]`, `keywords: ["markdown", "kanban", "hexfield", "task board", "syntax highlighting"]`
- [ ] `contributes.configuration`: user-configurable token colors (optional override per token type — see [USER_GUIDE.md Configuration section](USER_GUIDE.md#configuration))
- [ ] Thorough README with before/after screenshot or animated GIF
- [ ] CHANGELOG.md
- [ ] Publish to VS Code Marketplace via `vsce publish`
- [ ] Open PR on Hexfield Deck to add companion recommendation in its README and Marketplace listing

**Acceptance criteria:**
- Extension passes `vsce package` validation
- Extension published to Marketplace under `jimblom.hexfield-text`
- Hexfield Deck README links to Hexfield Text

---

## Open Questions

1. **Checkbox styling depth:** Should `[/]` get a distinct color purely via grammar, or should the decorator also handle `[x]` and `[/]` for richer editor effects (e.g., a strikethrough on done task lines)? Leaning toward grammar-only for checkboxes and keeping the decorator focused on dates only.

2. **Shared date logic with Hexfield Deck core:** The date proximity logic in `@hexfield-deck/core` could be extracted to a published npm package (`@hexfield/utils`) and consumed by both extensions. Not worth it at this scale — inline the logic and revisit if a third product needs it.

---

## Dependencies & Toolchain

- **No runtime dependencies** — grammar is pure JSON, decorator is vanilla VS Code API
- **No dependency on `@hexfield-deck/core`** — keep the extension lightweight and independently installable
- Minimum VS Code version: **1.75+** (matches Hexfield Deck)
- TypeScript, esbuild for bundling (match Hexfield Deck toolchain)
- Volta for Node.js version management (match Hexfield Deck)
- pnpm for package management (match Hexfield Deck)
- Marketplace extension ID: `jimblom.hexfield-text`

---

## Success Metrics

- Extension installs and activates without errors on a fresh VS Code install
- All token categories colorized correctly (project, date, priority, estimate, in-progress checkbox, frontmatter keys)
- Due date colors match the board's badge colors exactly (same hex values)
- Zero false-positive colorization on known non-planner markdown files (e.g., the Hexfield Deck README itself, this IMPLEMENTATION_PLAN.md)
- Published to Marketplace and linked from Hexfield Deck

---

*Last updated: 2026-02-23*
*Planning origin: [docs/hexfield-text-plan.md](https://github.com/jimblom/Hexfield-Deck/blob/main/docs/hexfield-text-plan.md) in Hexfield-Deck*
