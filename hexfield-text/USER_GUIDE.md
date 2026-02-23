# Hexfield Text User Guide

Complete reference for installing, configuring, and using Hexfield Text.

---

## What Is Hexfield Text?

Hexfield Text is a VS Code extension that adds syntax highlighting and dynamic colorization to [Hexfield Deck](https://github.com/jimblom/Hexfield-Deck) planner files. It makes the markdown editor reflect the same visual language as the Hexfield Deck board:

- Project tags, priorities, time estimates, and checkbox states are colorized by the TextMate **grammar** (static colors, zero runtime cost)
- Due dates are colorized by a **decoration API** that computes proximity to today and mirrors the board's badge colors exactly

Colorization is strictly scoped. Hexfield Text only activates on files with `type: hexfield-planner` in their YAML frontmatter. Regular markdown files are never touched.

---

## Requirements

- VS Code 1.75 or later
- A Hexfield Deck planner file (see [File Identity](#file-identity) below)

Hexfield Text does not require Hexfield Deck to be installed — but the two are designed as companions. Hexfield Deck gives you the board view; Hexfield Text gives you a colorized editor view of the same file.

---

## Installation

### From the VS Code Marketplace

1. Open the Extensions sidebar (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for **Hexfield Text**
3. Click **Install**

After installation, open any Hexfield Deck planner file and colorization activates automatically.

### From a VSIX File

1. Download the latest `.vsix` from the [Releases](../../releases) page
2. In VS Code: `Extensions → ⋯ → Install from VSIX...`
3. Select the downloaded file
4. Reload VS Code when prompted

### From Source

```bash
git clone git@github.com:jimblom/hexfield-text.git
cd hexfield-text
pnpm install
pnpm build
pnpm package
```

Then install the generated `.vsix` as above.

---

## File Identity

Hexfield Text reads the YAML frontmatter of every `.md` file you open. If the file contains `type: hexfield-planner`, the extension promotes it to the `hexfield-markdown` language mode, and all colorization activates.

**Required frontmatter field:**

```yaml
---
type: hexfield-planner
week: 7
year: 2026
tags: [planner, weekly]
---
```

If `type: hexfield-planner` is absent, Hexfield Text does nothing to the file. Edit or remove the field while the file is open and colorization toggles off immediately — no reload needed.

> **Tip:** Hexfield Deck's week template generator (`generateWeekTemplate()`) includes `type: hexfield-planner` automatically in new files.

---

## Token Reference

### Static Tokens (TextMate Grammar)

These are colorized by the TextMate grammar contribution. Colors appear as soon as the file is opened.

#### Project Tags

```markdown
- [ ] Fix Hexfield Viewscreen rendering glitch #hexfield !!
- [/] Rewire nacelle couplings #deep13 est:3h
```

| Syntax | Color | Hex |
|---|---|---|
| `#project-name` | Blue | `#569CD6` |

**Rules:**
- The `#` must be preceded by a space (or appear at the start of the title)
- A `#` inside a URL (`https://example.com/page#section`) is not treated as a project tag

#### Due Dates

Due date brackets are colorized by the **Decoration API** (see [Dynamic Due Date Colors](#dynamic-due-date-colors)), not the grammar. The grammar contributes a default gray color as a baseline; the decorator overrides it.

#### Priority

```markdown
- [ ] Critical failure !!!
- [ ] Should probably fix !!
- [ ] Nice to have !
```

| Syntax | Label | Color | Hex |
|---|---|---|---|
| `!!!` | HIGH | Red | `#F44747` |
| `!!` | MED | Yellow | `#CCA700` |
| `!` | LOW | Green | `#89D185` |

#### Time Estimates

```markdown
- [ ] Long session est:4h
- [ ] Quick check est:30m
- [ ] Fractional est:1.5h
```

| Syntax | Color | Hex |
|---|---|---|
| `est:Xh` / `est:Xm` | Teal | `#4EC9B0` |

#### Checkbox States

```markdown
- [ ] To do
- [/] In progress
- [x] Done
```

| Syntax | State | Color | Hex |
|---|---|---|---|
| `[ ]` | To Do | Default (no override) | — |
| `[/]` | In Progress | Orange | `#CE9178` |
| `[x]` | Done | Default (no override) | — |

The `[/]` checkbox gets a distinct orange color to make in-progress tasks immediately visible while editing.

#### Frontmatter Keys

```yaml
---
type: hexfield-planner
week: 7
year: 2026
quarter: Q1
tags: [planner, weekly]
startDate: 2026-02-09
endDate: 2026-02-15
---
```

| Syntax | Color | Hex |
|---|---|---|
| Recognized frontmatter keys (`type:`, `week:`, `year:`, `quarter:`, `tags:`, `startDate:`, `endDate:`) | Purple | `#C586C0` |

---

### Dynamic Due Date Colors

Due date brackets (`[YYYY-MM-DD]`) are colorized by the Decoration API at runtime. The decorator scans the document for date tokens, computes proximity to today, and applies colors that exactly mirror Hexfield Deck's board badge colors.

```markdown
- [ ] Already missed this [2026-01-15]        ← Red (overdue)
- [ ] Due right now [2026-02-23]              ← Orange (today)
- [ ] Due in two days [2026-02-25]            ← Yellow (within 3 days)
- [ ] Plenty of time [2027-01-01]             ← Gray (future)
```

| Proximity | Color | Hex |
|---|---|---|
| Overdue (date < today) | Red | `#F44747` |
| Today | Orange | `#CE9178` |
| Within 3 days | Yellow | `#CCA700` |
| Future | Gray | `#858585` |

**Update behavior:** The decorator runs on file open and re-runs 500ms after every document change (debounced). Edit a date and the color updates nearly instantly.

---

## Configuration

> Token color configuration is planned for v1.0.0 (Phase 3). The settings listed here describe the intended behavior.

In VS Code Settings (`Ctrl+,`), search for **hexfield-text** to access:

```json
{
  "hexfield-text.colors.projectTag": "#569CD6",
  "hexfield-text.colors.priorityHigh": "#F44747",
  "hexfield-text.colors.priorityMed": "#CCA700",
  "hexfield-text.colors.priorityLow": "#89D185",
  "hexfield-text.colors.timeEstimate": "#4EC9B0",
  "hexfield-text.colors.inProgressCheckbox": "#CE9178",
  "hexfield-text.colors.frontmatterKey": "#C586C0",
  "hexfield-text.colors.dueDateOverdue": "#F44747",
  "hexfield-text.colors.dueDateToday": "#CE9178",
  "hexfield-text.colors.dueDateSoon": "#CCA700",
  "hexfield-text.colors.dueDateFuture": "#858585"
}
```

All settings have defaults matching the values in the Token Reference above. Any setting left unset uses the default.

---

## How Scoping Works

Hexfield Text uses a **custom language ID** (`hexfield-markdown`) rather than hooking into VS Code's built-in `text.html.markdown` language. This is why colorization never leaks onto regular markdown files.

When you open a `.md` file:

1. Hexfield Text reads the YAML frontmatter
2. If `type: hexfield-planner` is found, it calls `setTextDocumentLanguage(document, 'hexfield-markdown')`
3. VS Code promotes the file's language mode to `hexfield-markdown`
4. The TextMate grammar (scoped to `hexfield-markdown` only) fires
5. The Decoration API (document selector: `{ language: 'hexfield-markdown' }`) fires

If `type: hexfield-planner` is not found, step 2 never happens. The file stays as `text.html.markdown`. The grammar and decorator never see it.

Built-in VS Code markdown features (preview, folding, link detection) are preserved — the `hexfield-markdown` language declares `markdown` as its base language via `embeddedLanguages`, so you don't lose anything.

---

## Troubleshooting

### Colorization not activating

- Confirm the file has `type: hexfield-planner` in its YAML frontmatter (must be the very first block in the file, fenced by `---`)
- Check the language mode indicator in the bottom-right of VS Code — it should read **Hexfield Markdown** (not **Markdown**)
- If it still reads **Markdown**, try closing and reopening the file

### Language mode shows "Hexfield Markdown" but no colors appear

- Ensure Hexfield Text is installed and enabled (not just installed but disabled)
- Check the **Output** panel (`View → Output`) and select **Hexfield Text** from the dropdown for error messages
- Try reloading VS Code (`Developer: Reload Window` from the Command Palette)

### Due date colors are wrong or not updating

- Due date colors are computed relative to today's date at runtime — if the colors seem off, confirm the date format is exactly `YYYY-MM-DD` (e.g., `[2026-02-23]`, not `[02/23/2026]`)
- The decorator runs 500ms after the last edit — wait a moment after changing a date
- Check that the bracket wraps the date with no extra spaces: `[2026-02-23]`, not `[ 2026-02-23 ]`

### Colors don't match the Hexfield Deck board

- If you've customized token colors in VS Code settings, your theme's token color rules may override them. Check `editor.tokenColorCustomizations` in your `settings.json`.
- The decorator colors (due dates) use `TextEditorDecorationType` and are not affected by theme token rules — they should always match the board.

### Regular markdown files suddenly colorized

This should not happen with correct usage. If it does:

1. Check that the affected file does not have `type: hexfield-planner` in its frontmatter
2. Report the issue at [github.com/jimblom/hexfield-text/issues](https://github.com/jimblom/hexfield-text/issues) with the file's frontmatter block

---

## Version History

| Version | Highlights |
|---|---|
| **v0.1.0** | Initial release — language ID promotion, TextMate grammar, static token colors |
| **v0.2.0** | Decoration API — dynamic due date proximity coloring |
| **v1.0.0** | Marketplace release — extension icon, user-configurable colors, CHANGELOG |

---

## Related

- [Hexfield Deck](https://github.com/jimblom/Hexfield-Deck) — The companion kanban board extension
- [Hexfield Deck User Guide](https://github.com/jimblom/Hexfield-Deck/blob/main/USER_GUIDE.md) — Full planner file format reference
