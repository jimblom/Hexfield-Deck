# Development Environment Setup

Quick reference for setting up the Hexfield Deck development environment.

---

## Prerequisites

### 1. Install Volta (Node.js Version Manager)

**Windows (PowerShell):**
```powershell
# Option 1: Using winget (recommended)
winget install Volta.Volta

# Option 2: Download installer
# https://github.com/volta-cli/volta/releases/latest
```

**After installation:**
```powershell
# IMPORTANT: Restart your terminal/PowerShell

# Verify installation
volta --version

# Install Node.js LTS
volta install node

# Install pnpm
volta install pnpm

# Verify
node --version   # Should show v20.x.x or v22.x.x
pnpm --version   # Should show v8.x.x or v9.x.x
```

**Related documentation:**
- [ADR-0001: Use Volta for Node.js Version Management](docs/decisions/0001-use-volta-for-node-version-management.md)
- [Volta official website](https://volta.sh/)

---

### 2. Configure Git for Cross-Platform Development

```powershell
# Set line endings to LF (Unix-style) everywhere
git config --global core.autocrlf input
git config --global core.eol lf

# Verify
git config --global core.autocrlf  # Should show "input"
git config --global core.eol       # Should show "lf"
```

**Why this matters:** Prevents line ending issues between Windows (CRLF) and Unix (LF) developers.

**Related documentation:**
- See LEARNING.md section "Git Line Endings Configuration"
- [GitHub docs on line endings](https://docs.github.com/en/get-started/getting-started-with-git/configuring-git-to-handle-line-endings)

---

### 3. Install VS Code Extensions

Open VS Code and install recommended extensions:
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier - Code formatter (`esbenp.prettier-vscode`)
- EditorConfig (`editorconfig.editorconfig`)
- Vitest (`vitest.explorer`)

VS Code should prompt you automatically when you open the project (via `.vscode/extensions.json`).

---

## Project Setup (Phase 1 - Coming Soon)

Once your environment is ready, we'll:
1. Initialize the monorepo structure
2. Create workspace packages (core, vscode-extension)
3. Set up build tooling (TypeScript, esbuild)
4. Install dependencies

**Not ready yet!** This section will be filled in during Phase 1 implementation.

---

## Configuration Files

The following configuration files have been created for cross-platform consistency:

### Source Control
- **`.gitattributes`** - Enforces LF line endings for all text files
- **`.gitignore`** - Ignores build outputs, dependencies, OS files

### Code Quality
- **`.editorconfig`** - Editor-agnostic formatting (4 spaces, LF endings)
- **`.prettierrc`** - Opinionated code formatter config
- **`.prettierignore`** - Files to exclude from Prettier formatting

### Build & Type Checking
- **`tsconfig.json`** - TypeScript configuration (root)
- **`.npmrc`** - pnpm package manager settings

### VS Code
- **`.vscode/extensions.json`** - Recommended extensions
- **`.vscode/settings.json`** - Workspace settings (format on save, etc.)

---

## Verification Checklist

Before proceeding to Phase 1, verify:

- [ ] Volta is installed: `volta --version`
- [ ] Node.js is installed via Volta: `node --version` (v20+ or v22+)
- [ ] pnpm is installed via Volta: `pnpm --version` (v8+ or v9+)
- [ ] Git line endings configured: `git config --global core.autocrlf` shows "input"
- [ ] VS Code is installed
- [ ] Recommended VS Code extensions installed
- [ ] You can open this project in VS Code without errors

---

## Troubleshooting

### Volta commands not found (Windows)
**Problem:** After installing Volta, commands like `volta` or `node` not recognized.

**Solution:** Restart your terminal/PowerShell. Volta adds itself to PATH during installation, but the change only takes effect in new terminal sessions.

```powershell
# Close and reopen PowerShell, then:
volta --version
```

---

### Git still using CRLF
**Problem:** Git is still checking out files with CRLF despite configuration.

**Solution:** The `.gitattributes` file in this repo overrides your global settings. If files were already checked out with CRLF:

```powershell
# Re-checkout all files with correct line endings
git rm --cached -r .
git reset --hard
```

---

### VS Code not recognizing TypeScript version
**Problem:** VS Code shows TypeScript errors or wrong version.

**Solution:** Select workspace TypeScript version:
1. Open any `.ts` file
2. Press `Ctrl+Shift+P`
3. Type "TypeScript: Select TypeScript Version"
4. Choose "Use Workspace Version"

---

## Next Steps

Once your environment is set up and verified:

1. **Read the documentation:**
   - [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) - Phased development plan
   - [USER_GUIDE.md](USER_GUIDE.md) - Final product features
   - [CLAUDE.md](CLAUDE.md) - Project overview

2. **Explore the ADRs:**
   - [docs/decisions/](docs/decisions/) - Architectural decision records
   - Understand why we chose each technology

3. **Start Phase 1:** Initialize the monorepo structure
   - Create workspace packages
   - Set up build tooling
   - Begin core parser development

---

## Learning Resources

- **[LEARNING.md](LEARNING.md)** - Daily journal of things learned
- **[STUDY.md](STUDY.md)** - Topics to explore deeper
- **[docs/decisions/](docs/decisions/)** - Architectural decision records

Update these as you learn! They're valuable for future reference and contributors.

---

**Last Updated:** 2026-02-13
