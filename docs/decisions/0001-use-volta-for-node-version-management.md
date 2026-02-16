# ADR-0001: Use Volta for Node.js Version Management

**Status:** Accepted
**Date:** 2026-02-13
**Deciders:** Jim Lindblom
**Tags:** tooling, cross-platform, developer-experience

## Context

Hexfield Deck will be developed on Windows but needs to support contributors on macOS and Linux. We need a Node.js version manager that:
- Works consistently across all platforms
- Minimizes environment setup friction for new contributors
- Allows pinning specific Node/npm/pnpm versions per project
- Integrates well with PowerShell (Windows) and bash/zsh (Unix)

**Alternatives considered:**
1. **Direct Node.js install** - Simple but no version management, manual updates
2. **nvm-windows** - Windows-only, requires separate nvm setup on Unix (inconsistent DX)
3. **fnm (Fast Node Manager)** - Cross-platform, fast (Rust), but less mature ecosystem
4. **Volta** - Cross-platform, automatic version switching, growing adoption

## Decision

We will use **Volta** as the standard Node.js version manager for this project.

## Rationale

### Why Volta over alternatives:

**Cross-platform consistency:**
- Same installation and usage commands on Windows/macOS/Linux
- No bash dependency (works natively in PowerShell)
- Written in Rust (single binary, fast startup)

**Automatic version switching:**
- Reads `volta` field in package.json
- No need to remember `nvm use` or `.nvmrc` files
- Version is pinned in source control, not a hidden dotfile

**Team-friendly:**
- New contributors get the right versions automatically
- No "works on my machine" issues due to version mismatches
- Clear documentation in package.json

**Performance:**
- Fast (Rust implementation)
- Uses shims (minimal overhead vs. PATH manipulation)

**Low maintenance:**
- Set it once in package.json, forget it
- Updates are explicit (not automatic like some version managers)

### Trade-offs accepted:

**Less common than nvm:**
- Volta has smaller community than nvm (but growing)
- Fewer StackOverflow answers (but excellent docs)

**Mitigation:** We also specify `engines` field in package.json as fallback for developers who prefer other tools.

## Consequences

### Positive:
- ✅ Contributors on any OS use identical setup steps
- ✅ No Node version mismatches between team members
- ✅ Versions documented in package.json (visible, versioned)
- ✅ Automatic switching when entering project directory

### Negative:
- ❌ One additional tool to install (vs. direct Node.js install)
- ❌ Smaller community than nvm (fewer online resources)

### Neutral:
- ⚖️ Developers can still use alternative version managers if they prefer (engines field provides compatibility)
- ⚖️ Adds ~10MB to developer machine (Volta binary + shims)

## Installation

### Windows (PowerShell):
```powershell
# Using winget
winget install Volta.Volta

# Or download installer
# https://github.com/volta-cli/volta/releases/latest
```

### macOS:
```bash
curl https://get.volta.sh | bash
```

### Linux:
```bash
curl https://get.volta.sh | bash
```

### After installation:
```bash
# Restart terminal, then:
volta install node    # Installs latest LTS
volta install pnpm    # Installs pnpm globally
```

## Resources

- [Volta official website](https://volta.sh/)
- [Volta GitHub repository](https://github.com/volta-cli/volta)
- [Why Volta over nvm?](https://blog.volta.sh/2020/03/10/announcing-volta/)
- [Volta documentation](https://docs.volta.sh/)
- [Package.json engines field](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#engines)

## Follow-up Study

- [ ] How does Volta's shim system work under the hood?
- [ ] What is Rust's cross-compilation story for Windows/macOS/Linux?
- [ ] Compare Volta vs fnm performance benchmarks
- [ ] How does Volta handle multiple projects with different Node versions?
- [ ] Can Volta pin npm package versions (not just Node/npm/pnpm)?

## Related ADRs

- [ADR-0002: Use pnpm for Package Management](0002-use-pnpm-for-package-management.md)
- [ADR-0004: Monorepo Structure with pnpm Workspaces](0004-monorepo-with-pnpm-workspaces.md)
