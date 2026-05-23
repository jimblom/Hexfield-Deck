# ADR-0015: Remove `[project]` syntax; promote tags as sole organizational label

**Status:** Accepted  
**Date:** 2026-05-23

## Context

Hexfield Deck originally supported two organizational primitives:

- **Projects** — `[name]` bracket syntax, one per card, displayed as a rectangular badge with per-project color configuration.
- **Tags** — `#tag` hashtag syntax, multiple per card, displayed as oval pill badges.

In practice these two concepts overlapped: both serve as categorical labels for cards. Having two parallel systems added parser complexity, UI surface (a separate Projects panel), and schema overhead (`project?: string` on every Card object) without meaningfully different semantics. The bracket syntax was also fragile — the regex that stripped `[name]` from titles was distinct from date extraction and caused subtle ordering dependencies in the parser.

## Decision

Remove the `[project]` concept entirely. Tags are the sole organizational label.

- `extractProject()` is deleted from the parser. The bracket regex is repurposed as a **display-only cleanup step**: any `[word]` token remaining after all other extractors run is stripped from the rendered title without rewriting the file. This means existing markdown files with `[project]` tokens display clean titles immediately, with no migration required.
- `project?: string` is removed from the `Card` interface and `RebuildCard`.
- `rebuildTaskLine()` no longer writes `[project]` tokens. The normalized write-back order is now: `title #tag1 #tag2 [date] !!! est:Xh`.
- Tags gain per-tag color configuration (`TagConfig`: `color`, `style`).
- A **tag priority list** (ordered `string[]`) determines which tag's color applies to a card when the card has multiple colored tags. The first tag in the list that is present on the card and has a configured color wins.
- The Projects panel is replaced by a Tags panel that includes the swatch picker, style selector, and a priority list reordering UI.
- The project filter dimension is removed from `FilterDropdown`. Tag filtering (multi-select OR logic) remains unchanged.
- The "Project" sort option is replaced by a "Tag" sort (alphabetical by first tag).

## Rationale

- Tags already support everything projects did (grouping, visual distinction) and more (multiple per card, filter by OR).
- Eliminating projects removes a parallel code path in the parser, the type model, the serializer, the filter, the sort bar, and the UI panel — reducing complexity across all layers.
- The display-only cleanup for legacy files avoids any destructive migration while keeping the board UI clean.
- Per-tag colors with a priority list generalize the card accent color concept cleanly to multi-tag cards without ambiguity.

## Consequences

- **Breaking change for existing files**: Cards with `[project]` tokens no longer display a project badge. The `[project]` text is silently stripped from the rendered title; the raw markdown is untouched. Users who relied on project badges as visual grouping should switch to `#tags`.
- The `hexfield-deck.projects` VS Code setting is superseded by `hexfield-deck.tagConfig` and `hexfield-deck.tagPriorityList`. Old project settings are orphaned (not migrated).
- Obsidian: the `[bracket]` token colorizer in the source editor is removed. The `projectTag` color setting is removed from the settings tab.
- The `extractProject` function is removed from the `@hexfield-deck/core` public API. Any consumers that called it directly will need to update.
