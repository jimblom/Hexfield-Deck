# ADR-0002: Use pnpm for Package Management

**Status:** Accepted
**Date:** 2026-02-13
**Deciders:** Jim Lindblom
**Tags:** tooling, monorepo, performance

## Context

We need a package manager for the Hexfield Deck monorepo that:
- Supports workspaces (monorepo with multiple packages)
- Is fast and disk-efficient
- Prevents phantom dependencies (importing undeclared packages)
- Works well on Windows, macOS, and Linux
- Is industry-standard and well-maintained

**Alternatives considered:**
1. **npm** - Default, universal, but slower and allows phantom dependencies
2. **yarn v1** - Fast, popular, but in maintenance mode
3. **yarn v3+ (Berry)** - Modern, but PnP mode has compatibility issues
4. **pnpm** - Fast, strict, excellent monorepo support

## Decision

We will use **pnpm** as the package manager for this project.

## Rationale

### Why pnpm over alternatives:

**Disk efficiency:**
- Content-addressable storage: All versions of a package stored once globally
- Hard links to global store (not copies)
- Saves gigabytes of disk space across projects

**Strict dependency resolution:**
- No phantom dependencies (can't import packages not in package.json)
- Prevents accidental reliance on hoisted dependencies
- Catches bugs early (stricter than npm/yarn)

**Monorepo support:**
- First-class workspace support (better than npm)
- Filter commands for selective installs (`pnpm install --filter core`)
- Workspace protocol (`workspace:*`) for internal dependencies

**Performance:**
- Faster installs than npm (parallel, efficient caching)
- Comparable to yarn v1, faster than yarn v3

**Cross-platform:**
- Works identically on Windows, macOS, Linux
- Handles Windows symlinks/junctions correctly

**Growing adoption:**
- Used by Vue, Vite, Prisma, SvelteKit, Turborepo
- Industry trend moving toward pnpm

### Trade-offs accepted:

**Less universal than npm:**
- Not included by default with Node.js
- Requires separate installation
- Some legacy tools may not support pnpm (rare)

**Mitigation:** We document installation steps clearly and use `packageManager` field in package.json to auto-install correct version via Corepack.

## Consequences

### Positive:
- ✅ Strict dependency resolution catches bugs early
- ✅ Disk space savings (50-70% less than npm)
- ✅ Faster installs, especially in CI/CD
- ✅ Excellent monorepo support (workspace:* protocol)
- ✅ No phantom dependencies

### Negative:
- ❌ Requires installation (not bundled with Node.js)
- ❌ Smaller community than npm (but growing)
- ❌ Some legacy tools may not recognize pnpm (rare)

### Neutral:
- ⚖️ Different node_modules structure (symlinked) - usually not an issue
- ⚖️ Learning curve for developers coming from npm/yarn (minimal)

## Installation

```bash
# Via Volta (recommended, version pinned to project)
volta install pnpm

# Or via npm (one-time global install)
npm install -g pnpm

# Or via Corepack (Node.js 16.13+)
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

## Common Commands

```bash
# Install all dependencies
pnpm install

# Add dependency to specific workspace
pnpm add react --filter @hexfield-deck/vscode-extension

# Run script in all workspaces
pnpm run build --recursive

# Run script in specific workspace
pnpm run test --filter @hexfield-deck/core

# Update dependencies
pnpm update

# Check for outdated packages
pnpm outdated
```

## Resources

- [pnpm official website](https://pnpm.io/)
- [pnpm motivation and design](https://pnpm.io/motivation)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [Why pnpm over npm/yarn](https://pnpm.io/feature-comparison)
- [pnpm symlinked node_modules structure](https://pnpm.io/symlinked-node-modules-structure)

## Follow-up Study

- [ ] How does pnpm's content-addressable storage work?
- [ ] What are phantom dependencies and why are they problematic?
- [ ] How do symlinks/hard links work differently on Windows vs Unix?
- [ ] What is the workspace protocol (`workspace:*`)?
- [ ] How does pnpm's strict mode differ from npm's hoisting?

## Related ADRs

- [ADR-0001: Use Volta for Node.js Version Management](0001-use-volta-for-node-version-management.md)
- [ADR-0004: Monorepo Structure with pnpm Workspaces](0004-monorepo-with-pnpm-workspaces.md)
