# Hexfield Deck

> **Markdown-powered kanban task board for VS Code and Obsidian**

Hexfield Deck transforms your markdown weekly planner files into interactive kanban boards. Write tasks in plain text with inline metadata, then visualize and manage them on a drag-and-drop board — all without ever leaving your editor.

![Hexfield Deck — Standard View](docs/screenshots/phase-6-standard.png)

| Swimlane View | Standard View |
|:---:|:---:|
| ![Swimlane View](docs/screenshots/phase-6-swimlane.png) | ![Standard View](docs/screenshots/phase-6-standard.png) |

![Filtering](docs/screenshots/phase-7-filtering.png)

---

## ✨ Features

### v1.0.0

- ✅ **VS Code extension + Obsidian plugin** — Full feature parity across both editors
- ✅ **3-column kanban board** (To Do / In Progress / Done)
- ✅ **Slates & Rows** — H1 headings define named Slates; every H2 is a swimlane Row; tasks without an H2 fall into an implicit default row
- ✅ **Per-Slate navigation** — Header dropdown switches between H1 Slates; each Slate has Standard and Swimlane views
- ✅ **Five task statuses** — `[ ]` To Do, `[/]` In Progress, `[x]` Done, `[-]` Won't Do, `[!]` Blocked
- ✅ **`//` comment syntax** — Annotate headings (`## Monday // Feb 9`) and tasks (`- [ ] Fix bug // waiting on Joel`) without affecting display or metadata parsing
- ✅ **Drag-and-drop editing** — Move cards between columns or swimlane rows to update status and section
- ✅ **Interactive sub-task checkboxes** — Click to cycle through To Do → In Progress → Done
- ✅ **Live markdown sync** — Board updates automatically as you edit the file
- ✅ **Rich metadata badges** — Projects, tags, due dates, priorities, time estimates — each visually distinct
- ✅ **Color-coded due dates** — Overdue (red), today (orange), upcoming (yellow), future (gray)
- ✅ **Overdue card highlight** — Red top border on overdue cards for at-a-glance visibility
- ✅ **Sub-task progress tracking** — Completion count and progress bar shown on card
- ✅ **Right-click context menu** — Edit title, due date, estimate, priority, state; Move within or across Slates; Delete
- ✅ **Quick Add** — `+` button inserts a task into the active Slate's current day row
- ✅ **Click card → jump to source** — Click any card to open the markdown file at that task's line
- ✅ **Inline markdown rendering** — Bold, italic, strikethrough, code spans, and links render in card titles; links open in the browser
- ✅ **Metadata filtering** — Filter by project, status, priority, due date, and time estimate; Won't Do and Blocked hidden by default
- ✅ **Search** — Real-time title search in the toolbar, applied on top of active filters
- ✅ **Card sorting** — File order, priority, status, project, or estimate
- ✅ **Slate progress indicator** — Header shows completion fraction and progress bar for the active Slate
- ✅ **Project color configuration** — Per-project card colors, styles, and URL links from the Projects toolbar panel
- ✅ **Configurable badge colors** — Badge colors follow `hexfield.colors.*` settings, shared with Hexfield Text
- ✅ **Hexfield Text compatibility** — Works alongside the [Hexfield Text](https://github.com/jimblom/hexfield-text) companion extension for editor syntax highlighting

### Coming Soon

- 🗓️ **Week navigation** — Browse weeks with auto-file creation

---

## 🚀 Quick Start

### Installation

#### VS Code

**From Release:**

1. Download the latest `.vsix` from the [Releases](../../releases) page
2. In VS Code: `Extensions → ⋯ → Install from VSIX...`
3. Select the downloaded `.vsix` file

**From Source:**

```bash
git clone git@github.com:jimblom/Hexfield-Deck.git
cd Hexfield-Deck
pnpm install && pnpm build
cd packages/vscode-extension && pnpm package
# Install the generated .vsix file via Extensions → ⋯ → Install from VSIX...
```

#### Obsidian

**Via BRAT (recommended for beta):**

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin
2. In BRAT settings, add beta repo: `jimblom/Hexfield-Deck`
3. Enable **Hexfield Deck** in Settings → Community Plugins

**Manual install:**

1. Download `obsidian-hexfield-deck.zip` from the [Releases](../../releases) page
2. Extract the zip into `.obsidian/plugins/hexfield-deck/` in your vault
3. Enable **Hexfield Deck** in Settings → Community Plugins

### Usage

#### VS Code
1. Open a markdown file (see [example format](#markdown-format))
2. Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **"Hexfield Deck: Open Board"**
4. The board opens beside your editor with live updates

#### Obsidian
1. Open a markdown file in your vault
2. Click the grid icon in the ribbon, or run **"Open as Hexfield Board"** from the command palette
3. The board opens in a new pane with live updates

---

## 📝 Markdown Format

Hexfield Deck parses structured markdown files with a specific format:

```markdown
---
type: hexfield-planner
week: 7
year: 2026
tags: [planner, weekly]
---

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

- [ ] Fix escape pod hatch [sol] !! est:1h #maintenance

## This Quarter

- [ ] Launch Hexfield Deck v1.0 [hexfield] [2026-03-31] !!!
```

**Checkbox states:**

| Marker | Status | Notes |
|--------|--------|-------|
| `[ ]` | To Do | Default |
| `[/]` | In Progress | |
| `[x]` | Done | |
| `[-]` | Won't Do | Hidden by default |
| `[!]` | Blocked | Hidden by default |

**Metadata syntax:**

- `[project-name]` → Project — displayed as a rectangular badge; supports per-project colors
- `#tag-name` → Tag — displayed as an oval pill badge; multiple tags supported
- `[2026-02-15]` → Due date (color-coded by proximity)
- `!!!` / `!!` / `!` → Priority (high / medium / low)
- `est:2h` → Time estimate
- `// comment text` → Comment — shown in italic beneath the card title; stripped from metadata parsing

**Inline Markdown in Titles:**

Card and sub-task titles support inline markdown formatting:

| Syntax | Renders as |
|--------|-----------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `~~strikethrough~~` | ~~strikethrough~~ |
| `` `code` `` | `code` |
| `[link text](https://example.com)` | clickable link (opens in browser) |

> **Note:** URL fragments like `https://example.com#section` are handled correctly — the `#section` part is not treated as a project tag.

See [examples/weekly-planner.md](examples/weekly-planner.md) for a complete example.

---

## 📚 Documentation

- **[User Guide](USER_GUIDE.md)** — Complete usage documentation
- **[Setup Guide](SETUP.md)** — Development environment setup
- **[Implementation Plan](IMPLEMENTATION_PLAN.md)** — Roadmap and phases
- **[Architecture Decisions](docs/decisions/)** — Technical ADRs

---

## 🛠️ Development

### Prerequisites

- [Volta](https://volta.sh/) for Node.js version management
- [pnpm](https://pnpm.io/) for package management

### Setup

```bash
git clone git@github.com:jimblom/Hexfield-Deck.git
cd Hexfield-Deck
pnpm install
pnpm build
```

### Testing the Extension

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open `examples/weekly-planner.md` in the new window
4. Run **"Hexfield Deck: Open Board"**

### Architecture

This is a monorepo with four packages:

```
packages/
├── core/              # Shared TypeScript library (parser, models, editor utilities)
├── webview-ui/        # Shared React UI (board, cards, context menu, filters)
├── vscode-extension/  # VS Code extension (host bridge + WebviewPanel)
└── obsidian-plugin/   # Obsidian plugin (host bridge + ItemView)
```

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the full technical plan.

---

## 🎯 Roadmap

| Phase        | Status      | Description                                                   |
| ------------ | ----------- | ------------------------------------------------------------- |
| **Phase 1**  | ✅ Complete | Core parser + basic webview board                             |
| **Phase 2**  | ✅ Complete | Drag-and-drop + real-time sync                                |
| **Phase 3**  | ✅ Complete | Interactive sub-task checkboxes                               |
| **Phase 4**  | ✅ Complete | Multiple views & sorting                                      |
| **Phase 5**  | ✅ Complete | Context menu CRUD operations                                  |
| **Phase 6**  | ✅ Complete | Inline markdown rendering                                     |
| **Phase 7**  | ✅ Complete | Metadata filtering                                            |
| **Phase 8**  | ✅ Complete | Slates (H1/H2 layout), per-Slate nav, Blocked, `//` comments |
| **Phase 9**  | ✅ Complete | v1.0.0 polish — search, progress, jump-to-source, empty states |
| **Phase 10** | ✅ Complete | Obsidian plugin — full feature parity                         |

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for detailed phase breakdowns.

---

## 🎬 About the Name

**Hexfield Deck** is named after the **Hexfield Viewscreen** on the Satellite of Love from _Mystery Science Theater 3000_ — the ship's main visual display and communication screen. The name is a triple reference:

- **Hexfield** — The iconic hexagonal viewscreen
- **Deck** — The command deck where the viewscreen lives, a deck of cards (kanban), and the connotation of command/oversight

---

## 📜 License

MIT License — Copyright (c) 2026 Jim Lindblom (jimblom)

See [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome. Feel free to:

- 🐛 [Report bugs](../../issues)
- 💡 [Suggest features](../../issues)
- 📖 [Improve documentation](../../pulls)

---

## 🔗 Links

- **Repository:** [github.com/jimblom/Hexfield-Deck](https://github.com/jimblom/Hexfield-Deck)
- **Issues:** [github.com/jimblom/Hexfield-Deck/issues](https://github.com/jimblom/Hexfield-Deck/issues)
- **Author:** Jim Lindblom ([@jimblom](https://github.com/jimblom))
- **License:** MIT

---

**Keep the Satellite running. Keep your tasks in order. Welcome to Hexfield Deck.** 🚀
