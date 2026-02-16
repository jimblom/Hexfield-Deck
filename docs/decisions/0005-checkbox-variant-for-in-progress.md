# ADR-0005: Use [/] Checkbox Variant for In-Progress Status

**Status:** Accepted
**Date:** 2026-02-13
**Deciders:** Jim Lindblom
**Tags:** markdown, user-experience, parsing

## Context

Hexfield Deck has three task states:
1. **Todo** - Not started
2. **In Progress** - Actively working on
3. **Done** - Completed

Markdown has a standard checkbox syntax:
- `- [ ]` - Unchecked (todo)
- `- [x]` - Checked (done)

We need a way to represent "in progress" status that:
- Is visible in plain markdown (without the board)
- Doesn't conflict with project tags (`#project-name`)
- Is easy to type and understand
- Works in standard markdown renderers (GitHub, Obsidian, etc.)

**Alternatives considered:**
1. **Tag-based:** `- [ ] Task #wip` or `- [ ] Task #in-progress`
   - Conflicts with project tags
   - Requires parsing tags to distinguish status from project
   - Clutters task title

2. **Checkbox variant:** `- [/] Task`
   - Visual "partial" indicator
   - No conflict with tags
   - Supported by some markdown renderers (Obsidian, GitHub)

3. **Unicode checkbox:** `- [◐] Task` or `- [▶] Task`
   - Hard to type
   - Not standard ASCII
   - May render incorrectly on some systems

4. **Custom syntax:** `- [~] Task` or `- [>] Task`
   - Less intuitive
   - Not used by other tools

## Decision

We will use **`- [/] Task`** as the markdown syntax for in-progress tasks.

## Rationale

### Why `[/]` over alternatives:

**No tag conflicts:**
- Project tags are `#project-name`
- In-progress is `[/]` in checkbox
- Clear separation of concerns

**Visual intuition:**
- `[ ]` = empty = todo
- `[/]` = partial = in progress
- `[x]` = filled = done
- The `/` visually represents "partially complete"

**Typing convenience:**
- Standard ASCII character
- Easy to type on any keyboard
- No special unicode input required

**Markdown compatibility:**
- GitHub renders `[/]` as indeterminate checkbox
- Obsidian supports `[/]` for partial tasks
- Degrades gracefully in other renderers (shows as `[/]` literally)

**Parseability:**
- Unambiguous regex: `/^- \[([ x\/])\]/`
- Three distinct states: ` `, `x`, `/`

**User-friendly:**
- Intuitive to understand
- Visible in raw markdown
- No hidden metadata

### Trade-offs accepted:

**Not universal standard:**
- Not part of CommonMark spec
- Some markdown renderers show it literally

**Mitigation:** Users primarily interact via the board UI (where it's rendered correctly). Raw markdown is secondary interface.

**Can't use `/` for other purposes:**
- `/` in checkbox is reserved for in-progress
- Unlikely to conflict (checkboxes rarely use `/`)

## Consequences

### Positive:
- ✅ No conflict with project tags
- ✅ Visible in plain markdown
- ✅ Intuitive visual representation
- ✅ Easy to type (standard ASCII)
- ✅ Supported by GitHub and Obsidian
- ✅ Clean parsing (no regex ambiguity)

### Negative:
- ❌ Not part of CommonMark standard
- ❌ May render literally in some markdown viewers

### Neutral:
- ⚖️ Users primarily interact via board UI (markdown is fallback)
- ⚖️ Adds a third checkbox state (simple, but more to document)

## Behavior

### Drag-and-drop transitions:

| From | To | Markdown Change |
|------|----------------|-----------------|
| Todo | In Progress | `- [ ]` → `- [/]` |
| In Progress | Todo | `- [/]` → `- [ ]` |
| In Progress | Done | `- [/]` → `- [x]` |
| Done | In Progress | `- [x]` → `- [/]` |
| Done | Todo | `- [x]` → `- [ ]` |
| Todo | Done | `- [ ]` → `- [x]` |

### Parsing logic:

```typescript
function parseCheckboxState(line: string): 'todo' | 'in-progress' | 'done' {
    const match = line.match(/^- \[([ x\/])\]/);
    if (!match) return 'todo';

    switch (match[1]) {
        case ' ': return 'todo';
        case '/': return 'in-progress';
        case 'x': return 'done';
        default: return 'todo';
    }
}
```

## Examples

```markdown
## Monday, February 5, 2026

- [ ] Not started task #project
- [/] Currently working on this #project
- [x] Completed task #project
```

## Resources

- [GitHub task lists](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/about-task-lists)
- [Obsidian checkboxes](https://help.obsidian.md/Editing+and+formatting/Basic+formatting+syntax#Task+lists)
- [CommonMark spec (checkboxes not in spec)](https://spec.commonmark.org/)

## Follow-up Study

- [ ] How do GitHub and Obsidian render `[/]` checkboxes?
- [ ] Are there other checkbox variants in common use?
- [ ] Can we contribute to CommonMark spec to standardize this?
- [ ] How do screen readers announce different checkbox states?

## Related ADRs

None yet (first markdown syntax decision).
