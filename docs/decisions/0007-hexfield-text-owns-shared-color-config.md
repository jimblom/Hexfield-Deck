# ADR-0007: Hexfield Text Owns the `hexfield.colors.*` Configuration Namespace

**Status:** Accepted
**Date:** 2026-02-28
**Deciders:** Jim Lindblom

## Context

Hexfield Deck reads a set of shared color values from VS Code configuration
(`hexfield.colors.*`) to colorize board badges — project tags, priority levels,
time estimates, and due-date proximity indicators. These same color tokens are
also the exact values that Hexfield Text (the companion syntax-highlighting
extension) colorizes in the markdown editor.

Hexfield Deck originally registered all `hexfield.colors.*` properties in its
own `package.json`. When Hexfield Text — which must also register or reference
those same properties for its `contributes.configuration` (Phase 3) — is
installed alongside Hexfield Deck, VS Code warns:

> "Configuration property `hexfield.colors.priorityHigh` already registered."

Two extensions cannot register the same configuration key without triggering
these warnings.

## Decision

**Hexfield Text owns the `hexfield.colors.*` configuration namespace.**

Hexfield Deck removes all `hexfield.colors.*` entries from its
`contributes.configuration` block. It continues to *read* those values at
runtime (with hardcoded fallback defaults) but no longer *registers* them.

## Rationale

Hexfield Text is the extension whose core purpose is syntax colorization — it
defines what each token color *means* in the editor. Owning the configuration
that controls those colors is a natural fit.

Hexfield Deck is a consumer of those color values (to keep board badge colors
in sync with editor token colors), not the definer. Having Hexfield Deck
register them was an artifact of it being built first, before Hexfield Text
existed.

The `_getColors()` method in `BoardWebviewPanel.ts` already uses sensible
hardcoded defaults for every property:

```typescript
cfg.get<string>("projectTag", "#569CD6")
```

So standalone Hexfield Deck users (no Hexfield Text installed) continue to get
correct colors from defaults. The only thing lost is VS Code Settings UI
discoverability for those properties — which Hexfield Text's own registration
will restore for users who have both extensions installed.

## Consequences

### Positive
- ✅ No duplicate registration warnings when both extensions are installed
- ✅ Single source of truth for `hexfield.colors.*` descriptions and defaults
- ✅ Clean separation: Hexfield Text defines editor colors, Hexfield Deck reads them
- ✅ Hexfield Deck runtime behavior is unchanged (fallback defaults cover standalone use)

### Negative
- ❌ Users with only Hexfield Deck installed cannot configure `hexfield.colors.*`
  via the VS Code Settings UI (those properties won't appear in the UI without
  Hexfield Text registered). They can still set values in `settings.json` manually.

### Neutral
- ⚖️ Hexfield Deck's `contributes.configuration` title updated from "Hexfield"
  to "Hexfield Deck" — only the board-specific `hexfield-deck.projects` setting
  remains in Hexfield Deck's manifest

## Related

- Hexfield Text planning document: `docs/hexfield-text-plan.md`
- ADR-0006: Line-by-line parser
