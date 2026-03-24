# Phase 9 — Polish & Marketplace Plan

**Branch:** `feature/phase-9-polish`
**Target:** v1.0.0 — VS Code Marketplace submission
**Status:** Draft — review before implementation begins

---

## What I found in the codebase

Before listing work, a few things worth knowing:

- **Jump to source is mostly already built.** `BoardWebviewPanel` already handles `openInMarkdown` messages at line 474 — opens the file, places the cursor at `card.lineNumber`, and centers the view. The only missing piece is the webview actually sending that message when a card is clicked. ~3 lines of code.
- **`Card.comment` is parsed and stored but never rendered.** Phase 8 added it; nothing ever surfaces it. Low-hanging fruit.
- **The swimlane grid template is hardcoded to 3 columns** (`140px 1fr 1fr 1fr` in CSS). The JSX already adds Blocked/Won't Do columns dynamically, but the CSS won't follow. This is a layout bug to fix.
- **`Row.date` (ISO string) exists for day rows.** The swimlane collapse initializer can use it to auto-expand today without new data.

---

## Track A — Marketplace requirements

Nothing ships without these.

### A1. Extension icon

A 128×128 PNG in `packages/vscode-extension/icon.png`, referenced in `package.json` via `"icon": "icon.png"`. Without it the listing looks abandoned.

Design direction: hex grid motif, or a simple viewscreen/monitor silhouette. Needs to read at both 128px and 32px (Activity Bar thumbnail). You can approve a design before I generate/commission it — or supply one yourself.

### A2. Empty states

Two cases currently show a blank void:

- **No cards in active Slate** — a centered message like *"No tasks in this slate. Add one with + or open the markdown file."*
- **Filters hide everything** — *"No cards match the current filters."* with a "Clear filters" link that calls `onChange(EMPTY_FILTER)`.

Both go in `App.tsx` as conditional renders wrapping the view components. Pure JSX, no new data.

### A3. `vsce package` clean run

Run `pnpm package` and chase down any warnings. Common culprits: missing `README` badges, `icon` field, or stale `activationEvents`. No code changes expected, just manifest cleanup.

---

## Track B — Developer delight (the "feels native" features)

These are the changes that make the tool feel like it belongs in VS Code rather than just living there.

### B1. Click card → jump to source  *(~15 min)*

Wire the existing `openInMarkdown` handler: add an `onClick` to the card's root `<div>` in `Card.tsx` that posts `{ type: "openInMarkdown", cardId: card.id }`. Needs `onPointerDown` propagation guard so it doesn't fire during drag. The extension side already does everything correctly.

This is the single most impactful feature for a developer audience. It closes the loop between the board and the file.

### B2. Today row auto-expand in Swimlane  *(~10 min)*

The swimlane `collapsed` state initializer currently collapses all non-day rows. Change it to: collapse rows where `!row.dayName` OR (row date is set AND it's not today's ISO date). Day rows without a date stay expanded as-is.

```ts
// current
if (!row.dayName) initial[row.key] = true;

// new
const todayISO = new Date().toISOString().slice(0, 10);
if (!row.dayName || (row.date && row.date !== todayISO)) initial[row.key] = true;
```

### B3. Overdue card border highlight  *(~20 min)*

`getDueDateColor()` in `Card.tsx` already returns `#F44747` for overdue dates. Extend this: when a card has a `dueDate` that's in the past, add a CSS class `card-overdue` to the card's root div. The class adds a subtle red left border (or a faint red background tint for fill-style cards).

The visual treatment needs to compose with the project color system — overdue should win over project color, or at minimum be visible alongside it. Suggest: a 2px red top border instead of left border so it doesn't conflict with the left-border project color.

### B4. Render `card.comment`  *(~10 min)*

`Card.comment` is stored but invisible. Add a single line below the title in `Card.tsx`:

```tsx
{card.comment && <div className="card-comment">{card.comment}</div>}
```

With CSS: `font-size: 11px; color: var(--vscode-descriptionForeground); font-style: italic; margin-top: 2px;`

This makes the `// comment` syntax actually useful in the UI — right now writing a comment in the markdown does nothing visible on the board.

---

## Track C — Power features

More work, higher payoff.

### C1. Search bar  *(~45 min)*

A text input in the toolbar (left of the Sort/Filter controls) that filters `slateCards` by title substring. State lives in `App.tsx` as `searchQuery: string`. The filter runs after the existing status/project/priority filters.

- Clears on Slate change
- Shows a small ✕ button when non-empty
- No debounce needed — it's all client-side and the card count is small

This pairs well with the filter system and addresses the "I know the card exists, where is it?" problem.

### C2. Slate progress indicator  *(~20 min)*

In the header, next to the `SlateSelector`, show completion for the active Slate:

```
[Weekly Planner ▼]    7 / 23 done  ████░░░░░░
```

Math: `slateCards.filter(c => c.status === "done").length` / `slateCards.length`. A thin progress bar + fraction label. Excludes wont-do/blocked from the denominator (they're not "remaining work"). Goes in `App.tsx` near the header.

### C3. Fix swimlane grid for dynamic columns  *(~15 min)*

The CSS has `grid-template-columns: 140px 1fr 1fr 1fr` hardcoded. When Blocked or Won't Do columns appear, the grid template doesn't update so layout breaks. Fix: move the column template to an inline style on `.swimlane-view`, computed from `statusColumns.length`:

```tsx
style={{ gridTemplateColumns: `140px repeat(${statusColumns.length}, 1fr)` }}
```

This is a bug fix, not a feature, but it's in this branch.

### C4. Column card counts in Standard view  *(~10 min)*

The swimlane already shows counts next to row labels. The Standard board columns don't. Add a count badge to `Column.tsx` next to the column title. The `cards` prop is already there — `cards.length` is the count.

### C5. Intra-column reorder  *(~2–3 hours)*

Cards can be dragged between columns/rows but not reordered *within* a column. `@dnd-kit/sortable` is already wired in `Card.tsx` and `SortableContext` is set up in `Column.tsx`. The missing pieces:

1. **Webview side:** `onDragEnd` in `Board.tsx` needs to handle same-column same-status drops and emit a new `reorderCard` message with `{ cardId, afterCardId }`.
2. **Extension side:** `BoardWebviewPanel` handles `reorderCard` by finding both cards' line numbers in the file and physically reordering the lines.
3. **Parser side:** line order is preserved in `lineNumber` already, so finding insertion points is straightforward.

This is the most work but it makes the board feel like a real kanban. The current behavior where dragging within a column does nothing is subtly confusing.

---

## Track D — Extension polish

### D1. Status bar item  *(~15 min)*

Show the active board filename in the VS Code status bar while the webview is open:

```
$(symbol-misc) tasks.md — Hexfield Deck
```

One `vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right)` in `BoardWebviewPanel`. Dispose it when the panel closes. Clicking it focuses the panel.

### D2. Keyboard shortcut for Quick Add  *(~10 min)*

Add to `package.json contributes.keybindings`:
```json
{
  "command": "hexfield-deck.quickAdd",
  "key": "ctrl+shift+a",
  "mac": "cmd+shift+a",
  "when": "hexfieldDeckBoardFocused"
}
```

Requires a registered command + a context key set when the webview panel is active. Moderate VS Code API wiring.

---

## Suggested implementation order

If we do this in one go:

1. **C3** first — it's a bug fix, get it out of the way
2. **B1** (jump to source) — biggest user-facing payoff for least work
3. **B2** (today auto-expand) — tiny, high daily-driver value
4. **B3** (overdue highlight) — visual polish, builds on existing color logic
5. **B4** (comment display) — completes the `//` comment feature story
6. **C4** (column counts) — two-minute parity fix
7. **C1** (search) — new UI surface, do it before the polish pass so we can style it together
8. **C2** (slate progress) — header polish
9. **D1** (status bar) — low risk, native feel
10. **A2** (empty states) — needs to know what the board looks like before writing copy
11. **A1** (icon) — async: design/source while code work is happening
12. **A3** (`vsce package`) — last, once everything else is done
13. **C5** (intra-column reorder) — largest, can be its own sub-PR if needed

---

## What I'd cut if time is short

- **D2** (keyboard shortcut) — the + button already works; this is convenience, not necessity
- **C5** (intra-column reorder) — ships correctly for v1.0 without it; revisit post-launch

---

## Open questions for your review

1. **Icon:** Do you have a visual direction, or should I propose something? Can do SVG-based with hex grid / viewscreen theme.
2. **Overdue highlight treatment:** Red top border (doesn't conflict with project left border) or faint red card background? Or both configurable?
3. **Intra-column reorder:** In or out for v1.0? It's the largest single chunk of work.
4. **Search bar placement:** Left of Sort, or should it replace the Sort bar with a combined search+sort control?

---

*Drafted by GPC — 2026-03-12. Review and mark up, then we'll start implementing.*
