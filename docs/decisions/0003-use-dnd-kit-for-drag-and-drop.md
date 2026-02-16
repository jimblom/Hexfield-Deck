# ADR-0003: Use @dnd-kit for Drag and Drop

**Status:** Accepted
**Date:** 2026-02-13
**Deciders:** Jim Lindblom
**Tags:** ui, react, accessibility, user-experience

## Context

The Hexfield Deck board requires drag-and-drop functionality to move cards between columns (Todo, In Progress, Done). We need a React drag-and-drop library that:
- Works well with React and TypeScript
- Is accessible (keyboard navigation, screen readers)
- Performs smoothly with many cards
- Is actively maintained
- Has good documentation and community support

**Alternatives considered:**
1. **react-beautiful-dnd** - Popular, mature, but in maintenance mode
2. **react-dnd** - Low-level, flexible, but more complex to implement
3. **@dnd-kit** - Modern, accessible, actively maintained
4. **Custom implementation** - Full control but high effort and accessibility challenges

## Decision

We will use **@dnd-kit** for all drag-and-drop interactions in the board UI.

## Rationale

### Why @dnd-kit over alternatives:

**Active maintenance:**
- Actively developed (react-beautiful-dnd is in maintenance mode)
- Regular updates and bug fixes
- Growing ecosystem

**Accessibility first:**
- Built-in keyboard navigation (arrow keys, space/enter to pick/drop)
- Screen reader announcements
- ARIA attributes handled automatically
- WCAG 2.1 compliant

**Performance:**
- Uses CSS transforms (GPU-accelerated)
- Minimal re-renders
- Virtual scrolling support for large lists

**Modern API:**
- React hooks-based
- TypeScript support out of the box
- Composable primitives (sensors, modifiers, collision detection)

**Flexibility:**
- Multiple collision detection algorithms
- Custom sensors (mouse, touch, keyboard, pointer)
- Sortable lists, multi-drag, nested contexts

**Bundle size:**
- Modular (only import what you need)
- Core is ~10KB gzipped

### Trade-offs accepted:

**Newer library:**
- Smaller community than react-beautiful-dnd (but growing fast)
- Fewer StackOverflow answers (but excellent docs)

**Migration path from react-beautiful-dnd not provided:**
- Different API (not a drop-in replacement)
- Requires learning new patterns

**Mitigation:** Excellent documentation and examples on the official site. Growing community adoption (used by Stripe, Linear, etc.).

## Consequences

### Positive:
- ✅ Accessible by default (keyboard, screen readers)
- ✅ Smooth performance (CSS transforms)
- ✅ TypeScript support
- ✅ Active maintenance and updates
- ✅ Flexible API (can extend for future needs)

### Negative:
- ❌ Newer library (less StackOverflow content)
- ❌ Different API than react-beautiful-dnd (not familiar)

### Neutral:
- ⚖️ More setup required than react-beautiful-dnd (but more flexible)
- ⚖️ Larger API surface (more to learn, but more capable)

## Example Usage

```typescript
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';

function Board() {
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        // Move card from active.id to over.id
    };

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <Column id="todo">
                {todoCards.map(card => <Card key={card.id} {...card} />)}
            </Column>
            <Column id="in-progress">
                {inProgressCards.map(card => <Card key={card.id} {...card} />)}
            </Column>
            <Column id="done">
                {doneCards.map(card => <Card key={card.id} {...card} />)}
            </Column>
        </DndContext>
    );
}
```

## Resources

- [@dnd-kit official documentation](https://docs.dndkit.com/)
- [@dnd-kit GitHub repository](https://github.com/clauderic/dnd-kit)
- [@dnd-kit examples and demos](https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com/)
- [Why we moved to @dnd-kit (Linear blog)](https://linear.app/blog/migrating-to-dnd-kit)
- [Accessibility guide](https://docs.dndkit.com/api-documentation/accessibility)

## Follow-up Study

- [ ] How does @dnd-kit achieve accessibility (keyboard, screen readers)?
- [ ] What are collision detection algorithms and when to use each?
- [ ] How do sensors work (mouse, touch, keyboard, pointer)?
- [ ] What are modifiers and how do they affect drag behavior?
- [ ] How does @dnd-kit handle multi-drag scenarios?
- [ ] Performance optimization techniques for large lists

## Related ADRs

None yet (first UI library decision).
