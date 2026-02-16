# Study Topics

Topics to explore deeper as time permits. Organized by priority and category.

---

## High Priority (Core to Project)

### Unified/Remark Markdown Parsing
**Why:** Core to our markdown parser - need to understand AST manipulation

**Topics to explore:**
- [ ] What is an Abstract Syntax Tree (AST)?
- [ ] How does unified's plugin architecture work?
- [ ] MDAST (Markdown AST) specification
- [ ] Writing custom remark plugins
- [ ] Parsing frontmatter with remark-frontmatter
- [ ] Traversing and manipulating AST nodes
- [ ] Performance considerations for large markdown files

**Resources:**
- [Unified documentation](https://unifiedjs.com/)
- [Guide to unified plugins](https://unifiedjs.com/learn/guide/create-a-plugin/)
- [MDAST specification](https://github.com/syntax-tree/mdast)
- [remark-parse source code](https://github.com/remarkjs/remark/tree/main/packages/remark-parse)
- [Video: Introduction to unified](https://www.youtube.com/watch?v=fDtn2Z1fMvw)

---

### React Hooks Deep Dive
**Why:** Webview UI uses hooks extensively - need to master patterns

**Topics to explore:**
- [ ] useEffect dependency array rules (what triggers re-runs?)
- [ ] useMemo vs useCallback - when to use each?
- [ ] Custom hooks: patterns and best practices
- [ ] useRef for DOM manipulation vs. useRef for mutable values
- [ ] useReducer for complex state management
- [ ] Rules of hooks (why they must be called unconditionally)
- [ ] Stale closures in effects (common gotcha)

**Resources:**
- [React docs: Hooks](https://react.dev/reference/react)
- [Kent C. Dodds: When to useMemo and useCallback](https://kentcdodds.com/blog/usememo-and-usecallback)
- [Dan Abramov: A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/)
- [Video: React Hooks explained](https://www.youtube.com/watch?v=TNhaISOUy6Q)

---

### @dnd-kit Architecture
**Why:** Drag-and-drop is core interaction - need to understand internals

**Topics to explore:**
- [ ] How does @dnd-kit differ from react-beautiful-dnd?
- [ ] Accessibility implementation (keyboard, screen readers, ARIA)
- [ ] Collision detection algorithms (which to use when?)
- [ ] Sensors: mouse, touch, keyboard, pointer (how do they work?)
- [ ] Modifiers: restrict movement, snap to grid, etc.
- [ ] Custom drop zones and droppable areas
- [ ] Multi-drag scenarios
- [ ] Performance optimization for large lists

**Resources:**
- [@dnd-kit documentation](https://docs.dndkit.com/)
- [@dnd-kit examples](https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com/)
- [GitHub: @dnd-kit source code](https://github.com/clauderic/dnd-kit)
- [Linear blog: Migrating to @dnd-kit](https://linear.app/blog/migrating-to-dnd-kit)

---

### date-fns ISO Week Calculations
**Why:** Week navigation is core feature - need reliable date math

**Topics to explore:**
- [ ] ISO 8601 week date system (why is it defined this way?)
- [ ] Week 1 definition: "first week with Thursday"
- [ ] Week years vs calendar years (edge cases)
- [ ] How `getISOWeek()` calculates week number
- [ ] How `startOfISOWeek()` finds Monday of a week
- [ ] Edge case: Dec 29 might be week 1 of next year
- [ ] Leap years and their effect on week calculations

**Resources:**
- [ISO 8601 Wikipedia](https://en.wikipedia.org/wiki/ISO_8601#Week_dates)
- [date-fns getISOWeek source](https://github.com/date-fns/date-fns/blob/main/src/getISOWeek/index.ts)
- [date-fns documentation](https://date-fns.org/)
- [Interactive ISO week calculator](https://www.epochconverter.com/weeknumbers)

---

## Medium Priority (Important Context)

### VS Code Extension API
**Why:** Building a VS Code extension - need to understand platform

**Topics to explore:**
- [ ] Extension activation events (onLanguage, onCommand, etc.)
- [ ] Webview lifecycle and disposal
- [ ] Webview <-> Extension messaging (postMessage, onDidReceiveMessage)
- [ ] File system watchers (onDidChangeTextDocument)
- [ ] Extension host vs UI process (where does code run?)
- [ ] Webview security (CSP, script nonces)
- [ ] Extension settings and configuration
- [ ] Command registration and palette integration

**Resources:**
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)

---

### pnpm Internals
**Why:** Using pnpm for monorepo - understanding internals helps troubleshoot

**Topics to explore:**
- [ ] Content-addressable storage design
- [ ] How hard links work (vs symlinks vs copies)
- [ ] Symlinks on Windows (junction points vs symlinks)
- [ ] Workspace protocol (`workspace:*` in package.json)
- [ ] Phantom dependencies (what are they and why are they bad?)
- [ ] Hoisting behavior (how pnpm differs from npm/yarn)
- [ ] `node_modules` structure in pnpm vs npm

**Resources:**
- [pnpm motivation](https://pnpm.io/motivation)
- [pnpm symlinked node_modules structure](https://pnpm.io/symlinked-node-modules-structure)
- [pnpm FAQ](https://pnpm.io/faq)
- [pnpm blog](https://medium.com/pnpm)

---

### TypeScript Advanced Types
**Why:** Strong typing improves code quality and catches bugs

**Topics to explore:**
- [ ] Conditional types (`T extends U ? X : Y`)
- [ ] Template literal types (type-safe string manipulation)
- [ ] Mapped types (transforming object types)
- [ ] Type guards and narrowing
- [ ] Discriminated unions (pattern matching)
- [ ] `as const` for literal types
- [ ] `satisfies` operator (new in TS 4.9)
- [ ] Generic constraints and inference

**Resources:**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Total TypeScript (Matt Pocock)](https://www.totaltypescript.com/)
- [Type Challenges](https://github.com/type-challenges/type-challenges)

---

### Obsidian Plugin API
**Why:** Phase 8 - need to port extension to Obsidian

**Topics to explore:**
- [ ] Obsidian plugin architecture
- [ ] Vault API (file system access)
- [ ] Markdown processing in Obsidian
- [ ] Custom views and UI components
- [ ] Settings and configuration
- [ ] Mobile support (iOS/Android)
- [ ] Plugin submission process

**Resources:**
- [Obsidian Plugin Developer Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian API Reference](https://github.com/obsidianmd/obsidian-api)
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Obsidian Community Plugins](https://github.com/obsidianmd/obsidian-releases)

---

## Low Priority (Nice to Have)

### Volta Internals
**Why:** Understanding our version manager helps troubleshoot

**Topics to explore:**
- [ ] How do Volta shims work on Windows?
- [ ] What is a shim? (executable that delegates to another executable)
- [ ] Rust cross-compilation for Windows/macOS/Linux
- [ ] How does Volta detect which version to use? (walk up directories to find package.json)
- [ ] What is stored in ~/.volta/ directory?

**Resources:**
- [Volta GitHub repository](https://github.com/volta-cli/volta)
- [Volta architecture docs](https://github.com/volta-cli/volta/blob/main/ARCHITECTURE.md)
- [Rust book](https://doc.rust-lang.org/book/)

---

### esbuild (Build Tool)
**Why:** We'll use esbuild for bundling - understanding it optimizes builds

**Topics to explore:**
- [ ] How is esbuild so fast? (Go, parallelism, no AST serialization)
- [ ] esbuild vs webpack vs rollup (trade-offs)
- [ ] Tree shaking and dead code elimination
- [ ] Code splitting strategies
- [ ] Source maps for debugging
- [ ] Watch mode and incremental builds
- [ ] Plugin system

**Resources:**
- [esbuild documentation](https://esbuild.github.io/)
- [esbuild architecture](https://esbuild.github.io/architecture/)
- [Why is esbuild fast?](https://esbuild.github.io/faq/#why-is-esbuild-fast)

---

### Vitest (Testing Framework)
**Why:** We'll use Vitest for testing - need to write good tests

**Topics to explore:**
- [ ] How does Vitest differ from Jest?
- [ ] Snapshot testing (when to use, when to avoid)
- [ ] Mocking modules and functions
- [ ] Testing async code (promises, async/await)
- [ ] Code coverage (what's a good percentage?)
- [ ] UI mode for debugging tests
- [ ] Integration with VS Code

**Resources:**
- [Vitest documentation](https://vitest.dev/)
- [Vitest API reference](https://vitest.dev/api/)
- [Testing best practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

### Regular Expressions (Regex)
**Why:** Parsing markdown requires regex - need to master patterns

**Topics to explore:**
- [ ] Regex basics (character classes, quantifiers, groups)
- [ ] Lookahead and lookbehind assertions
- [ ] Non-capturing groups `(?:...)`
- [ ] Named capture groups `(?<name>...)`
- [ ] Greedy vs lazy matching
- [ ] Common pitfalls (catastrophic backtracking)
- [ ] Testing and debugging regex

**Resources:**
- [RegexOne tutorial](https://regexone.com/)
- [Regex101 (online tester)](https://regex101.com/)
- [MDN: Regular Expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)

---

## Completed Studies

### ✅ Git Line Endings
**Studied:** 2026-02-13
**Key takeaways:**
- `core.autocrlf=input` prevents CRLF on checkout (always use LF)
- `.gitattributes` is source of truth, overrides global config
- `* text=auto eol=lf` normalizes all text files to LF
- Windows uses CRLF by default, but LF works fine everywhere

**Resources used:**
- [GitHub docs on line endings](https://docs.github.com/en/get-started/getting-started-with-git/configuring-git-to-handle-line-endings)

---

## Template for New Topics

Copy-paste this template when adding new study topics:

### [Topic Name]
**Why:** [Why is this relevant to Hexfield Deck or your learning goals?]

**Topics to explore:**
- [ ] [Specific question or concept]
- [ ] [Another question]

**Resources:**
- [Link to documentation]
- [Link to article/video]

---

## Study Session Notes

When you complete a study topic, add notes here before moving it to "Completed Studies":

### [Date]: [Topic Name]

**What I learned:**
[Summary of key concepts]

**Surprises:**
[Anything unexpected or counterintuitive]

**How it applies to Hexfield Deck:**
[Specific use cases in our project]

---
