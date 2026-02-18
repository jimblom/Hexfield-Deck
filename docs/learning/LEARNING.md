# Learning Log

Running journal of things learned while building Hexfield Deck.

---

## 2026-02-13: Development Environment Setup

### Volta for Node.js Version Management

**What I'm planning to do:**
1. Install Volta via `winget install Volta.Volta`
2. Restart terminal (important for PATH updates)
3. Install Node.js LTS: `volta install node`
4. Install pnpm: `volta install pnpm`

**Why Volta:**
- Cross-platform (same commands on Windows/Mac/Linux)
- Automatic version switching (reads `volta` field in package.json)
- No bash dependency (works in PowerShell)

**Commands to remember:**
```powershell
volta list              # Show all installed tools and versions
volta pin node@20       # Pin Node version to package.json
volta install pnpm      # Install pnpm globally via Volta
```

**Related ADR:** [ADR-0001: Use Volta for Node.js Version Management](docs/decisions/0001-use-volta-for-node-version-management.md)

**Further reading needed:**
- How do Volta shims work on Windows?
- What is Rust's cross-compilation story?

---

### Git Line Endings Configuration

**What I learned:** Windows uses CRLF (`\r\n`) line endings, while Unix (macOS/Linux) uses LF (`\n`). Without proper configuration, this causes:
- Every line showing as changed when switching between Windows and Unix contributors
- Merge conflicts on every line
- Inconsistent behavior between platforms

**Configuration applied:**
```bash
# Tell Git to never convert LF to CRLF on checkout
git config --global core.autocrlf input

# Use LF for new files
git config --global core.eol lf
```

**Why `autocrlf=input` not `autocrlf=true`:**
- `autocrlf=true` (Windows default): Converts LF→CRLF on checkout, CRLF→LF on commit
- `autocrlf=input` (recommended): Never converts on checkout, converts CRLF→LF on commit
- We want LF everywhere, so `input` ensures we never get CRLF

**Verification:**
```bash
git config --global core.autocrlf  # Should show "input"
```

**Project-level enforcement:**
Created `.gitattributes` file with:
```
* text=auto eol=lf
```

This overrides user settings and enforces LF for all text files in the repository.

**Gotcha:** `.gitattributes` is the source of truth, not global config. This ensures consistent behavior even if contributors have different global Git settings.

**Resources:**
- [GitHub docs on line endings](https://docs.github.com/en/get-started/getting-started-with-git/configuring-git-to-handle-line-endings)
- [Git config documentation](https://git-scm.com/docs/git-config#Documentation/git-config.txt-coreeol)

---

### EditorConfig for Cross-Platform Consistency

**What I learned:** Different editors have different defaults:
- VS Code defaults to spaces
- Some editors default to tabs
- Windows editors may default to CRLF
- Line width varies

**Solution:** `.editorconfig` file provides editor-agnostic configuration.

**Example `.editorconfig`:**
```ini
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 4
trim_trailing_whitespace = true
```

**Supported editors:**
- VS Code (via extension)
- JetBrains IDEs (built-in)
- Vim/Neovim (via plugin)
- Many others

**Why it matters:** A developer on macOS using Vim will format code identically to a developer on Windows using VS Code.

**Resources:**
- [EditorConfig.org](https://editorconfig.org/)
- [VS Code EditorConfig extension](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)

---

### pnpm Workspaces (Monorepo Structure)

**What I learned:** pnpm workspaces create a monorepo where multiple packages share dependencies efficiently.

**Key concepts:**

**Content-addressable storage:**
- All package versions stored once in global store (~/.pnpm-store)
- Hard-linked into project node_modules (not copied)
- Saves gigabytes of disk space

**Strict node_modules:**
- Each package only sees dependencies it declares
- No "phantom dependencies" (can't import undeclared packages)
- Catches bugs early

**Workspace protocol:**
- `workspace:*` in package.json links to local workspace package
- Always uses latest local version (no version sync issues)

**Example structure:**
```
hexfield-deck/
├── packages/
│   ├── core/
│   │   └── package.json  # { "name": "@hexfield-deck/core" }
│   └── vscode-extension/
│       └── package.json  # { "dependencies": { "@hexfield-deck/core": "workspace:*" } }
├── pnpm-workspace.yaml   # packages: ['packages/*']
└── package.json          # Root package
```

**Useful commands:**
```bash
pnpm install                          # Install all workspace dependencies
pnpm --filter core build              # Build only core package
pnpm --filter vscode-extension test   # Test only vscode extension
pnpm --recursive build                # Build all packages
```

**Gotcha:** When you change core package, VS Code extension must be rebuilt to see changes (or use watch mode).

**Related ADR:** [ADR-0004: Monorepo Structure with pnpm Workspaces](docs/decisions/0004-monorepo-with-pnpm-workspaces.md)

**Further study:**
- How does pnpm's content-addressable store work internally?
- What are the performance implications of symlinks on Windows?

**Resources:**
- [pnpm workspaces documentation](https://pnpm.io/workspaces)
- [pnpm symlinked node_modules structure](https://pnpm.io/symlinked-node-modules-structure)

---

### Code Formatting: Prettier

**What I learned:** Prettier is an opinionated code formatter that enforces consistent style across the codebase.

**Why opinionated is good:**
- No bikeshedding about formatting in PRs
- All code looks like it was written by one person
- Auto-format on save = never think about formatting

**Configuration (`.prettierrc`):**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 4,
  "useTabs": false,
  "endOfLine": "lf"
}
```

**Key settings explained:**
- `semi: true` - Always use semicolons (catches ASI bugs)
- `trailingComma: "es5"` - Trailing commas where valid (cleaner diffs)
- `singleQuote: true` - Single quotes for strings (convention)
- `printWidth: 100` - Max line width
- `tabWidth: 4` - 4 spaces per indent (our preference)
- `endOfLine: "lf"` - Unix line endings (consistent with .gitattributes)

**VS Code integration:**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

**Resources:**
- [Prettier documentation](https://prettier.io/docs/en/)
- [Why Prettier? (blog post)](https://prettier.io/docs/en/why-prettier.html)

---

### TypeScript Project References (Composite Projects)

**What I learned:** TypeScript can build monorepo packages with proper dependencies using "project references."

**Key concept:** Each package has its own `tsconfig.json` with `"composite": true`, allowing TypeScript to:
- Build packages in correct order
- Cache builds for faster rebuilds
- Provide "go to definition" across packages
- Type-check workspace dependencies

**Example root `tsconfig.json`:**
```json
{
  "files": [],
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/vscode-extension" }
  ]
}
```

**Example core `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

**Build command:**
```bash
tsc --build  # Builds all project references in correct order
```

**Further study:**
- How does TypeScript determine build order?
- What are `.tsbuildinfo` files?

**Resources:**
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

---

## 2026-02-14: [Placeholder for next session]

### [Topic]

**What I learned:**

**Gotcha:**

**Resources:**

---

## Template for New Entries

Copy-paste this template for new discoveries:

### [Topic Name]

**What I learned:**
[Brief explanation of the concept]

**Why it matters:**
[How it relates to Hexfield Deck or general development]

**Commands/Code:**
```bash
[Useful commands or code snippets]
```

**Gotcha:**
[Something unexpected or easy to get wrong]

**Related ADR:** [Link to relevant ADR if applicable]

**Further study:**
- [Topics to explore deeper]

**Resources:**
- [Links to documentation, articles, videos]

---
