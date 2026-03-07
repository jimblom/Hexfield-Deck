# The Hexfield Ecosystem

> This document describes the shared contracts between Hexfield extensions.
> If you're building a Hexfield-family tool, this is your integration spec.

---

## Overview

Hexfield is a family of focused VS Code extensions built around a common
markdown task format. Each tool does one thing well and coordinates with the
others through a small set of shared conventions: a file identity signal, a
language ID, and a pair of configuration namespaces.

Current extensions:

| Extension | ID | Purpose |
|---|---|---|
| **Hexfield Deck** | `jimblom.hexfield-deck` | Markdown-powered kanban board |
| **Hexfield Text** | `jimblom.hexfield-text` | Syntax highlighting for the editor |

More may follow. The contracts below apply to all of them.

---

## File Identity: `type: hexfield-planner`

A Hexfield planner file is a markdown file with this frontmatter field:

```yaml
---
type: hexfield-planner
week: 8
year: 2026
---
```

`type: hexfield-planner` is the canonical signal. Any Hexfield extension that
needs to scope its behavior to Hexfield files — and not fire on every `.md`
file in the workspace — should check for this field.

**Detection:** Read the YAML frontmatter and check `type === "hexfield-planner"`.
No regex heuristics, no other fields required.

---

## Language ID: `hexfield-markdown`

Hexfield Text promotes planner files to a custom VS Code language ID on open:

```typescript
vscode.languages.setTextDocumentLanguage(document, "hexfield-markdown");
```

All Hexfield extensions must accept both `markdown` and `hexfield-markdown` as
valid language IDs wherever they check. A file that has been promoted by
Hexfield Text is still a valid target for Hexfield Deck, context menus, etc.

**`when` clause example (package.json menus):**
```json
"when": "resourceLangId == markdown || resourceLangId == hexfield-markdown"
```

**TypeScript guard example:**
```typescript
if (doc.languageId !== "markdown" && doc.languageId !== "hexfield-markdown") {
  return; // not a Hexfield file
}
```

---

## Shared Color Configuration: `hexfield.colors.*`

**Owner: Hexfield Text.** This namespace is registered in Hexfield Text's
`package.json` only. Other extensions read from it but do not register it.

These are the token colors used by both the editor (Hexfield Text decorations)
and the board (Hexfield Deck badge colors). Keeping them in one place means a
user's color preferences are reflected in both surfaces automatically.

| Setting | Default | Applies to |
|---|---|---|
| `hexfield.colors.projectTag` | `#569CD6` | `#project` tag tokens |
| `hexfield.colors.priorityHigh` | `#F44747` | `!!!` tokens |
| `hexfield.colors.priorityMed` | `#CCA700` | `!!` tokens |
| `hexfield.colors.priorityLow` | `#89D185` | `!` tokens |
| `hexfield.colors.timeEstimate` | `#4EC9B0` | `est:Xh` tokens |
| `hexfield.colors.inProgressCheckbox` | `#CE9178` | `[/]` checkbox |
| `hexfield.colors.dueDateOverdue` | `#F44747` | Past due dates |
| `hexfield.colors.dueDateToday` | `#CE9178` | Due today |
| `hexfield.colors.dueDateSoon` | `#CCA700` | Due within 1–3 days |
| `hexfield.colors.dueDateFuture` | `#858585` | Due 4+ days out |

Extensions that read these values should provide the same defaults as fallbacks:

```typescript
const cfg = vscode.workspace.getConfiguration("hexfield.colors");
const projectTagColor = cfg.get<string>("projectTag", "#569CD6");
```

### CSS Variables (webview context)

Hexfield Deck maps these settings to CSS custom properties on the document root.
Webview UI components should use these variables with the hex fallback:

```css
color: var(--hx-project-tag, #569CD6);
color: var(--hx-priority-high, #F44747);
color: var(--hx-priority-med, #CCA700);
color: var(--hx-priority-low, #89D185);
color: var(--hx-time-estimate, #4EC9B0);
color: var(--hx-due-overdue, #F44747);
color: var(--hx-due-today, #CE9178);
color: var(--hx-due-soon, #CCA700);
color: var(--hx-due-future, #858585);
```

---

## Per-Project Configuration: `hexfield-deck.projects`

**Owner: Hexfield Deck.** Registered in Hexfield Deck's `package.json`.

A user-editable map of project names (without `#`) to per-project settings.
Any Hexfield extension that surfaces project-aware UI — color indicators,
clickable project badges, etc. — should read from and write to this namespace.

**Schema:**

```json
{
  "hexfield-deck.projects": {
    "type": "object",
    "additionalProperties": {
      "type": "object",
      "properties": {
        "color": {
          "type": "string",
          "description": "Hex color string"
        },
        "style": {
          "type": "string",
          "enum": ["border", "fill", "both"],
          "description": "How to apply the color (default: border)"
        },
        "url": {
          "type": "string",
          "description": "URL opened when the project badge is clicked"
        }
      }
    }
  }
}
```

**Style semantics:**

| Value | Effect |
|---|---|
| `border` | 3px solid left border on the card (default) |
| `fill` | ~10% opacity background tint |
| `both` | Border + tint together |

**Reading the config:**

```typescript
const projects = vscode.workspace
  .getConfiguration("hexfield-deck")
  .get<Record<string, { color?: string; style?: string; url?: string }>>("projects", {});
```

**Writing the config** (always `Global` target — these are user preferences,
not workspace settings):

```typescript
vscode.workspace
  .getConfiguration("hexfield-deck")
  .update("projects", newProjects, vscode.ConfigurationTarget.Global);
```

After writing, listen on `onDidChangeConfiguration` for `"hexfield-deck.projects"`
to refresh any UI that depends on it.

---

## Shared Color Palette

The following 12 colors are used as the curated swatch set in Hexfield Deck's
project color picker. They are drawn from the same palette as the token colors
above. Hexfield Text surfaces that offer color selection should use the same
swatches for visual consistency.

```
#569CD6  #4EC9B0  #89D185  #6A9955
#CCA700  #DCDCAA  #CE9178  #F44747
#F92672  #C586C0  #9CDCFE  #858585
```

---

## Summary: Who Owns What

| Namespace | Owner | Others may |
|---|---|---|
| `hexfield.colors.*` | Hexfield Text | Read (with fallback defaults) |
| `hexfield-deck.projects` | Hexfield Deck | Read and write |
| `hexfield-markdown` language ID | Hexfield Text | Accept alongside `markdown` |
| `type: hexfield-planner` frontmatter | Shared convention | Check to scope activation |

---

*See also: [ADR-0007](decisions/0007-hexfield-text-owns-shared-color-config.md) — configuration namespace ownership decision.*
