# Hexfield Deck — Obsidian Plugin

Hexfield Deck transforms your markdown files into interactive kanban boards without leaving Obsidian. Write tasks in plain text with inline metadata; visualize and manage them on a drag-and-drop board.

---

## Installation

### Via BRAT (recommended for beta)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin
2. In BRAT settings, click **Add Beta Plugin** and enter: `jimblom/Hexfield-Deck`
3. Enable **Hexfield Deck** in Settings → Community Plugins

### Manual install

1. Download `obsidian-hexfield-deck.zip` from the [Releases](https://github.com/jimblom/Hexfield-Deck/releases) page
2. Extract the zip — you should have `main.js`, `manifest.json`, and `styles.css`
3. Move those three files into a new folder: `<your-vault>/.obsidian/plugins/hexfield-deck/`
4. Enable **Hexfield Deck** in Settings → Community Plugins → toggle on

---

## Opening a Board

1. Open any markdown file formatted as a Hexfield board (see [Markdown Format](#markdown-format) below)
2. Click the **grid icon** (⊞) in the left ribbon  
   *or* open the command palette and run **"Open as Hexfield Board"**
3. The board opens in a new pane with live updates as you edit the file

---

## Features

All features available in the VS Code extension are available here:

- **Drag-and-drop** — Move cards between columns (To Do / In Progress / Done) or swimlane rows
- **Five statuses** — `[ ]` To Do, `[/]` In Progress, `[x]` Done, `[-]` Won't Do, `[!]` Blocked
- **Right-click context menu** — Edit title, due date, time estimate, priority, state; Move; Delete
- **Click card → jump to source** — Opens the markdown file at that task's line in a new tab
- **Metadata filtering** — Filter by project, status, priority, due date, or estimate
- **Search** — Real-time title search in the toolbar
- **Quick Add** — `+` button inserts a task into the active Slate's current row
- **Project colors** — Per-project card colors, badge styles, and URL links via the Projects panel
- **Sub-task progress** — Completion bar and clickable checkboxes for nested tasks
- **Slate navigation** — H1 headings become named Slates in the header dropdown
- **Standard and Swimlane views** — Toggle between kanban columns and swimlane grid

### Obsidian-specific notes

- **Context menus** use Obsidian's native menu system. Priority and State items show a checkmark next to the current value.
- **"Open in Markdown"** opens the file in a new Obsidian tab (vs. splitting the editor in VS Code).
- **Edit dialogs** (title, due date, estimate) appear as Obsidian modal popups.
- **Wikilinks** (`[[Note Name]]`) in card titles are rendered as clickable links.
- **Custom checkbox styles** — The `/`, `-`, and `!` checkbox variants are styled in the markdown editor for visual consistency with the board (in-progress = orange half-circle, won't-do = strikethrough, blocked = red exclamation).
- **Project config** is saved in the plugin's data store (`.obsidian/plugins/hexfield-deck/data.json`), not in the markdown file.

---

## Markdown Format

```markdown
# Week 7, 2026

## Monday // February 9, 2026

- [ ] Fix rendering glitch [hexfield] [2026-02-09] !! #bugfix // viewport calc was off
    - [x] Reproduce on the bridge
    - [ ] Write regression test
- [/] Rewire nacelle couplings [deep13] est:3h #maintenance
- [!] Coordinate with Gizmonic // waiting on Dr. Forrester

## Tuesday // February 10, 2026

- [ ] Ship parser v1 [hexfield] [2026-02-10] !!! est:4h

# Backlog

## Now

- [ ] Fix escape pod hatch [sol] !! est:1h
```

**Metadata syntax:**

| Syntax | Meaning |
|--------|---------|
| `[project-name]` | Project (rectangular badge, configurable color) |
| `#tag-name` | Tag (oval pill badge, multiple supported) |
| `[2026-02-15]` | Due date (color-coded by proximity) |
| `!!!` / `!!` / `!` | Priority: High / Medium / Low |
| `est:2h` | Time estimate |
| `// comment` | Comment (shown in italic beneath card title) |

See [examples/weekly-planner.md](../../examples/weekly-planner.md) for a complete example file.

For full documentation, see the [User Guide](../../USER_GUIDE.md).

---

## Settings

Open Settings → Hexfield Deck to configure:

- **Project colors** — Also configurable via the Projects panel in the toolbar (changes are per-file and stored in the plugin data)

Badge colors (`--hx-*` CSS variables) can be overridden per-vault via a CSS snippet in `.obsidian/snippets/`. See the [User Guide](../../USER_GUIDE.md) for the full list of variables.

---

## License

MIT — Copyright (c) 2026 Jim Lindblom
