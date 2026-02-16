# ADR-0004: Monorepo Structure with pnpm Workspaces

**Status:** Accepted
**Date:** 2026-02-13
**Deciders:** Jim Lindblom
**Tags:** architecture, code-sharing, maintainability

## Context

Hexfield Deck will be available as both a VS Code extension and an Obsidian plugin. These two platforms share significant logic:
- Markdown parsing (frontmatter, tasks, metadata extraction)
- Data models (Card, BoardData, SubTask interfaces)
- Business logic (date calculations, checkbox state manipulation)
- Potentially UI components (React components for webviews)

We need an architecture that:
- Maximizes code sharing between platforms
- Keeps platform-specific code isolated
- Maintains clear dependencies (core → platforms, not circular)
- Is easy to test and build
- Supports future platforms (e.g., CLI tool, web app)

**Alternatives considered:**
1. **Single package** - Simple but mixes concerns, hard to share code
2. **Separate repositories** - Clear separation but code duplication, sync issues
3. **Git submodules** - Shared code in submodule, but complex workflow
4. **Monorepo with npm workspaces** - Good, but npm is slower
5. **Monorepo with pnpm workspaces** - Fast, strict, excellent DX

## Decision

We will use a **monorepo structure with pnpm workspaces**, organized as:

```
hexfield-deck/
├── packages/
│   ├── core/               # Shared library (parser, models, utils)
│   ├── vscode-extension/   # VS Code extension
│   └── obsidian-plugin/    # Obsidian plugin (future)
├── pnpm-workspace.yaml
└── package.json
```

## Rationale

### Why monorepo:

**Code sharing:**
- Single source of truth for parsing logic
- Shared TypeScript interfaces ensure type safety across platforms
- Bug fixes in core automatically benefit all platforms
- Easier to maintain consistency

**Development velocity:**
- Change core and platform code in single commit
- No version sync issues between packages
- Easier refactoring (find all usages across packages)

**Testing:**
- Test core logic independently
- Platform tests can depend on known core behavior
- Easier to run integration tests

**Build tooling:**
- Shared configs (tsconfig, eslint, prettier)
- Single CI/CD pipeline
- Consistent versioning

### Why pnpm workspaces:

**Strict dependencies:**
- Each package must declare dependencies explicitly
- No phantom dependencies between workspace packages
- Clear dependency graph

**Performance:**
- Fast installs (hard-linked dependencies)
- Efficient disk usage (single node_modules)

**Workspace protocol:**
- `workspace:*` for internal dependencies
- Ensures packages always use latest local version
- No accidental publishing of internal packages

**Filtering:**
- Build/test single packages: `pnpm --filter core build`
- Selective installs in CI: `pnpm install --filter vscode-extension`

### Trade-offs accepted:

**Increased complexity:**
- More sophisticated build setup
- Need to understand workspace concepts
- More files and configuration

**Mitigation:** Clear documentation, phased approach (start with core + vscode, add obsidian later).

## Consequences

### Positive:
- ✅ 60-70% code sharing between platforms
- ✅ Type safety across package boundaries
- ✅ Single source of truth for business logic
- ✅ Easier to add new platforms in future
- ✅ Consistent tooling and configs

### Negative:
- ❌ More complex build setup than single package
- ❌ Need to manage workspace dependencies carefully
- ❌ Steeper learning curve for new contributors

### Neutral:
- ⚖️ Larger initial setup effort, but pays off over time
- ⚖️ All packages in one repo (easier to find code, but larger repo)

## Package Structure

### Core Package (`@hexfield-deck/core`)
**Purpose:** Platform-agnostic business logic

**Exports:**
- Parsers (frontmatter, tasks, metadata)
- Data models (Card, BoardData, SubTask)
- Utilities (date calculations, markdown manipulation)

**Dependencies:** Minimal (unified/remark, date-fns)

**No dependencies on:** VS Code API, Obsidian API, React

### VS Code Extension (`@hexfield-deck/vscode-extension`)
**Purpose:** VS Code-specific integration

**Exports:** VS Code extension bundle (.vsix)

**Dependencies:**
- `@hexfield-deck/core` (via `workspace:*`)
- VS Code API (`@types/vscode`)
- React (for webview UI)

### Obsidian Plugin (`@hexfield-deck/obsidian-plugin`)
**Purpose:** Obsidian-specific integration (Phase 8)

**Exports:** Obsidian plugin bundle

**Dependencies:**
- `@hexfield-deck/core` (via `workspace:*`)
- Obsidian API (`obsidian`)
- React (for views)

## Workspace Configuration

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'packages/*'
```

**Root package.json:**
```json
{
  "name": "hexfield-deck",
  "private": true,
  "scripts": {
    "build": "pnpm --recursive run build",
    "test": "pnpm --recursive run test",
    "lint": "pnpm --recursive run lint"
  }
}
```

**Core package.json:**
```json
{
  "name": "@hexfield-deck/core",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

**VS Code extension package.json:**
```json
{
  "name": "@hexfield-deck/vscode-extension",
  "dependencies": {
    "@hexfield-deck/core": "workspace:*"
  }
}
```

## Resources

- [pnpm workspaces documentation](https://pnpm.io/workspaces)
- [Monorepo best practices](https://monorepo.tools/)
- [Why monorepos? (Nx blog)](https://nx.dev/concepts/why-monorepos)
- [workspace protocol explained](https://pnpm.io/workspaces#workspace-protocol-workspace)

## Follow-up Study

- [ ] How does pnpm resolve workspace dependencies?
- [ ] What is the workspace protocol (`workspace:*`) and how does it work?
- [ ] How to structure shared configs (tsconfig, eslint) in monorepos?
- [ ] What are the build order requirements when packages depend on each other?
- [ ] How to handle versioning in monorepos (independent vs unified)?

## Related ADRs

- [ADR-0002: Use pnpm for Package Management](0002-use-pnpm-for-package-management.md)
- [ADR-0001: Use Volta for Node.js Version Management](0001-use-volta-for-node-version-management.md)
