# Hexfield Text

> **Bring your Hexfield Deck planner files to life in the VS Code editor**

Hexfield Text is a VS Code extension that colorizes Hexfield Deck metadata tokens inline in your markdown editor — project tags, due dates, priorities, time estimates, and checkbox states. Write and edit your weekly planner files with the same visual language you see on the board.

---

## ✨ What It Does

Hexfield Deck metadata renders as plain text when you're editing the source file. Hexfield Text closes that gap.

**In the editor, without Hexfield Text:**

```markdown
- [ ] Ship parser v1 #hexfield [2026-02-10] !!! est:4h
- [/] Rewire nacelle couplings #deep13 est:3h
```

**With Hexfield Text:**

- `#hexfield` — blue
- `[2026-02-10]` — color-coded by how close that date is to today (overdue → red, today → orange, soon → yellow, future → gray)
- `!!!` — red
- `est:4h` — teal
- `[/]` — orange (distinct from `[ ]` and `[x]`)

All colorization is **scoped strictly to Hexfield Deck planner files** — identified by `type: hexfield-planner` in the frontmatter. Regular markdown files, READMEs, and notes are never affected.

---

## 🎨 Token Reference

| Token | Example | Color |
|---|---|---|
| Project tag | `#hexfield` | Blue (`#569CD6`) |
| Due date — overdue | `[2026-01-01]` | Red (`#F44747`) |
| Due date — today | `[<today>]` | Orange (`#CE9178`) |
| Due date — within 3 days | `[<soon>]` | Yellow (`#CCA700`) |
| Due date — future | `[2027-01-01]` | Gray (`#858585`) |
| Priority HIGH | `!!!` | Red (`#F44747`) |
| Priority MED | `!!` | Yellow (`#CCA700`) |
| Priority LOW | `!` | Green (`#89D185`) |
| Time estimate | `est:2h` | Teal (`#4EC9B0`) |
| In-progress checkbox | `[/]` | Orange (`#CE9178`) |
| Frontmatter keys | `week:` `year:` `type:` | Purple (`#C586C0`) |

Due date colors update in real time — edit a date and the color changes within 500ms.

---

## ⚡ Requirements

- **VS Code** 1.75+
- A planner file with `type: hexfield-planner` in its YAML frontmatter (see [Hexfield Deck](https://github.com/jimblom/Hexfield-Deck))

Hexfield Text requires no runtime dependencies. The grammar is pure JSON; the date decorator is vanilla VS Code API.

---

## 🚀 Installation

**From the VS Code Marketplace (recommended):**

1. Open the Extensions sidebar (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for **Hexfield Text**
3. Click **Install**

**From a VSIX file (pre-release / development):**

1. Download the latest `.vsix` from the [Releases](../../releases) page
2. In VS Code: `Extensions → ⋯ → Install from VSIX...`
3. Select the downloaded `.vsix` file

**From source:**

```bash
git clone git@github.com:jimblom/hexfield-text.git
cd hexfield-text
pnpm install
pnpm build
pnpm package
# Install the generated .vsix file
```

---

## 📋 Activation

Hexfield Text reads the frontmatter of every `.md` file you open. If the file has `type: hexfield-planner`, the extension promotes it to the `hexfield-markdown` language mode and all colorization activates automatically.

Your planner file must include the `type` field:

```yaml
---
type: hexfield-planner
week: 7
year: 2026
tags: [planner, weekly]
startDate: 2026-02-09
endDate: 2026-02-15
---
```

Remove or change `type`, and colorization deactivates immediately — no VS Code restart needed.

See the [Hexfield Deck User Guide](https://github.com/jimblom/Hexfield-Deck/blob/main/USER_GUIDE.md) for the complete planner file format.

---

## 📚 Documentation

- **[User Guide](USER_GUIDE.md)** — Installation, full token reference, configuration, and troubleshooting
- **[Implementation Plan](IMPLEMENTATION_PLAN.md)** — Architecture, token scope map, and roadmap
- **[Hexfield Deck](https://github.com/jimblom/Hexfield-Deck)** — The companion kanban board extension

---

## 🎬 About the Name

**Hexfield Text** is part of the Hexfield product family, named after the **Hexfield Viewscreen** on the Satellite of Love from _Mystery Science Theater 3000_ — the ship's iconic hexagonal display and communication screen.

**Hexfield Deck** is the board view. **Hexfield Text** is the editor layer of the same interface — the source-level view of your planner data, brought to visual life.

---

## 📜 License

MIT License — Copyright (c) 2026 Jim Lindblom (jimblom)

See [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

This is a personal project in early development. Once v1.0.0 ships, contributions are welcome. Until then:

- 🐛 [Report bugs](../../issues)
- 💡 [Suggest features](../../issues)
- 📖 [Improve documentation](../../pulls)

---

## 🔗 Links

- **Repository:** [github.com/jimblom/hexfield-text](https://github.com/jimblom/hexfield-text)
- **Hexfield Deck:** [github.com/jimblom/Hexfield-Deck](https://github.com/jimblom/Hexfield-Deck)
- **Marketplace:** _(coming soon)_
- **Author:** Jim Lindblom ([@jimblom](https://github.com/jimblom))
- **Issues:** [Report a bug or request a feature](../../issues)

---

**The editor is part of the mission. Welcome to Hexfield Text.**
