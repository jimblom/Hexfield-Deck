# Hexfield Deck Implementation Plan

## Overview

This plan outlines the phased development of Hexfield Deck, a markdown-powered kanban task board for VS Code (with future Obsidian support). The goal is to deliver incremental value through focused phases while building toward a production-ready v1.0.0 release.

---

## Architecture

### Monorepo Structure

```
hexfield-deck/
├── packages/
│   ├── core/                      # Shared TypeScript library
│   │   ├── src/
│   │   │   ├── parser/            # Markdown parsing logic
│   │   │   │   ├── frontmatter.ts # YAML frontmatter parsing
│   │   │   │   ├── tasks.ts       # Task/checkbox parsing
│   │   │   │   └── metadata.ts    # Due dates, priority, time estimates
│   │   │   ├── models/            # Data structures
│   │   │   │   ├── Card.ts        # Card interface with metadata
│   │   │   │   ├── BoardData.ts   # Board state
│   │   │   │   └── SubTask.ts     # Sub-task with progress tracking
│   │   │   └── utils/             # Shared utilities
│   │   │       ├── dates.ts       # Week calculations (ISO 8601)
│   │   │       └── markdown.ts    # Markdown manipulation helpers
│   │   └── package.json
│   ├── vscode-extension/          # VS Code extension
│   │   ├── src/
│   │   │   ├── extension.ts       # Extension entry point
│   │   │   ├── commands/          # Command handlers
│   │   │   ├── webview/           # React webview UI
│   │   │   │   ├── components/    # React components
│   │   │   │   │   ├── Board.tsx  # Main board component
│   │   │   │   │   ├── Card.tsx   # Card component
│   │   │   │   │   ├── Column.tsx # Column component
│   │   │   │   │   └── ...
│   │   │   │   ├── views/         # View implementations
│   │   │   │   │   ├── StandardView.tsx
│   │   │   │   │   ├── SwimlaneView.tsx
│   │   │   │   │   └── BacklogView.tsx
│   │   │   │   └── App.tsx        # Root component
│   │   │   └── fileOperations/    # Markdown file manipulation
│   │   └── package.json
│   └── obsidian-plugin/           # Obsidian plugin (Phase 8)
│       ├── src/
│       └── package.json
├── pnpm-workspace.yaml            # Monorepo configuration
├── package.json                   # Root package.json
├── tsconfig.json                  # Shared TypeScript config
├── .eslintrc.js                   # Shared ESLint config
└── .prettierrc                    # Shared Prettier config
```

### Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Package Manager** | pnpm | Fast, efficient, industry standard for monorepos |
| **Language** | TypeScript | Type safety, required for VS Code and Obsidian |
| **Build Tool** | esbuild | Fast, modern, used by VS Code itself |
| **Markdown Parser** | Custom line-by-line | Zero-dep state machine; format is controlled (see ADR-0006) |
| **Webview UI** | React + TypeScript | Community familiarity, reusable for Obsidian |
| **Drag & Drop** | @dnd-kit | Modern, accessible, actively maintained |
| **Date Utils** | date-fns | Industry standard, robust ISO week calculations |
| **Testing** | Vitest | Fast, modern, better DX than Jest |
| **Linting** | ESLint + Prettier | Industry standard code quality |

### Shared Code Strategy

The `core` package will contain 60-70% of shared code:
- Markdown parsing (frontmatter, tasks, metadata extraction)
- Data models (Card, BoardData, SubTask interfaces)
- Business logic (week calculations, date utilities)
- Markdown manipulation (checkbox toggling, metadata updates)

Platform-specific packages (`vscode-extension`, `obsidian-plugin`) will:
- Wrap the core parser with platform APIs
- Implement platform-specific file I/O
- Render the shared React UI components in webviews/views

---

## Markdown File Structure

### Heading Hierarchy

```markdown
---
week: 1
year: 2026
tags: [planner, weekly]
start_date: 2026-02-05
end_date: 2026-02-11
---

## Monday, February 5, 2026        ← Level 2: Day section
- [ ] Task with inline project tag #hexfield-deck !!!
- [ ] Another task #time-chaser [2026-02-10] est:2h

**Work Section**                   ← IGNORED (visual organization only)
- [ ] Work task #project-name

## Tuesday, February 6, 2026       ← Level 2: Day section
- [ ] Task #project

## Backlog                          ← Level 2: Backlog container
### Now                             ← Level 3: Backlog subsection
- [ ] Urgent backlog item #project

### Next 2 Weeks                    ← Level 3: Backlog subsection
- [ ] Coming soon #project

### This Month                      ← Level 3: Backlog subsection
- [ ] Monthly goal #project

## This Quarter                     ← Level 2: Long-term backlog
- [ ] Quarterly objective #project

## This Year                        ← Level 2: Long-term backlog
- [ ] Annual goal #project

## Parking Lot                      ← Level 2: Long-term backlog
- [ ] Someday/maybe #project
```

### Key Parsing Rules

1. **Frontmatter Detection:** Files with `week:`, `year:`, and `tags:` fields are Hexfield Deck planners
2. **Day Sections:** Level 2 headings matching pattern `## {DayName}, {Month} {Day}, {Year}`
3. **Project Tags:** Extracted from inline `#tag-name` in task text
4. **Bold Text Ignored:** `**Section Name**` is ignored by parser (user's visual organization)
5. **Backlog Container:** `## Backlog` groups near-term subsections (`### Now`, `### Next 2 Weeks`, etc.)
6. **Long-term Sections:** `## This Quarter`, `## This Year`, `## Parking Lot` have no subsections
7. **Task Metadata:** Inline markers for due dates (`[2026-02-15]`), priority (`!!!`), time estimates (`est:2h`)

---

## Week File Auto-Creation

### Configuration

Make auto-creation configurable with smart defaults:

```json
// VS Code settings.json
{
  "hexfield-deck.weekFilePattern": "{year}/week-{WW}/{year}-{WW}-weekly-plan.md",
  "hexfield-deck.plannerRoot": "./planner"  // Relative to workspace root
}
```

### Behavior

- **Pattern Set:** Week navigation can auto-create files using the template
- **Pattern Not Set:** Week navigation disabled, extension is filename/folder agnostic
- **Default Template:** Generates frontmatter + day sections + backlog structure

### Template Generation

```typescript
import { setISOWeek, setISOWeekYear, startOfISOWeek, addDays, format } from 'date-fns';

function generateWeekTemplate(week: number, year: number): string {
  // Calculate the Monday of the target ISO week
  const startDate = startOfISOWeek(setISOWeek(setISOWeekYear(new Date(), year), week));
  const endDate = addDays(startDate, 6);
  const quarter = Math.ceil((startDate.getMonth() + 1) / 3);

  // Helper to format day heading: "Monday, February 5, 2026"
  const formatDayHeading = (date: Date) => format(date, 'EEEE, MMMM d, yyyy');
  const formatISODate = (date: Date) => format(date, 'yyyy-MM-dd');

  return `---
week: ${week}
year: ${year}
quarter: Q${quarter}
start_date: ${formatISODate(startDate)}
end_date: ${formatISODate(endDate)}
tags: [planner, weekly]
---

## ${formatDayHeading(startDate)}

## ${formatDayHeading(addDays(startDate, 1))}

## ${formatDayHeading(addDays(startDate, 2))}

## ${formatDayHeading(addDays(startDate, 3))}

## ${formatDayHeading(addDays(startDate, 4))}

## Backlog

### Now

### Next 2 Weeks

### This Month

## This Quarter

## This Year

## Parking Lot
`;
}
```

---

## Implementation Phases

### Phase 1: Core Foundation (Week 1-2) ✅
**Goal:** Basic board viewing works

**Tasks:**
- [x] Initialize monorepo with pnpm workspaces
- [x] Set up TypeScript configuration (shared + per-package)
- [x] Set up ESLint + Prettier
- [x] Core package: Frontmatter parser (YAML)
- [x] Core package: Task parser (checkboxes, inline project tags)
- [x] Core package: Metadata extractor (due dates, priority, time estimates)
- [x] Core package: Data models (Card, BoardData, SubTask interfaces)
- [x] VS Code extension: Basic activation (detect markdown files with frontmatter)
- [x] VS Code extension: Register "Hexfield Deck: Open Board" command
- [x] VS Code extension: Create webview panel
- [x] VS Code extension: Simple hardcoded HTML rendering
- [x] VS Code extension: Parse markdown → display cards in 3 columns (Todo/In Progress/Done)

**Deliverable:** Open a planner markdown file, run command, see cards displayed in a basic 3-column board.

**Acceptance Criteria:**
- ✅ Command palette shows "Hexfield Deck: Open Board"
- ✅ Opening a planner file displays webview with 3 columns
- ✅ Tasks are parsed and appear in correct columns based on checkbox state
- ✅ Inline project tags (`#project-name`) are recognized
- ✅ Metadata (due dates, priority, time) is displayed with color-coded badges
- ✅ Sub-task progress bars render correctly
- ✅ Board updates live when markdown file is edited

---

### Phase 2: Drag & Drop + Real-Time Sync (Week 2-3)
**Goal:** Interactive board with markdown sync

**Tasks:**
- [ ] Webview UI: Set up React + TypeScript build with esbuild
- [ ] Webview UI: Install and configure @dnd-kit/core and @dnd-kit/sortable
- [ ] Webview UI: Implement drag-and-drop between columns using @dnd-kit
- [ ] Webview UI: Send `moveCard` messages to extension
- [ ] Extension: Handle `moveCard` messages
- [ ] Extension: Update markdown file (toggle checkbox `[ ]` ↔ `[x]` ↔ `[/]`)
- [ ] Extension: Set up file watcher on current markdown document
- [ ] Extension: Debounced refresh (500ms after typing stops)
- [ ] Core: Checkbox state manipulation utilities (handle 3 states: `[ ]`, `[/]`, `[x]`)
- [ ] Core: Parse `[/]` checkbox variant as in-progress status

**Deliverable:** Drag cards between columns and see markdown file update in real-time. Edit markdown file and see board update automatically.

**Acceptance Criteria:**
- ✅ Drag card from Todo → In Progress changes `- [ ]` to `- [/]`
- ✅ Drag card from In Progress → Done changes `- [/]` to `- [x]`
- ✅ Drag card from Done → Todo changes `- [x]` to `- [ ]`
- ✅ Drag card from In Progress → Todo changes `- [/]` to `- [ ]`
- ✅ Drag card from Done → In Progress changes `- [x]` to `- [/]`
- ✅ Typing in markdown editor refreshes board after 500ms delay
- ✅ No excessive refreshes during rapid typing

---

### Phase 3: Metadata & Sub-tasks (Week 3-4)
**Goal:** Full task feature parity with metadata and sub-task support

**Tasks:**
- [ ] Core: Parse due dates (multiple formats: `[2026-02-15]`, `due:2026-02-15`)
- [ ] Core: Parse priority (`!!!` = high, `!!` = medium, `!` = low)
- [ ] Core: Parse time estimates (`est:2h`, `⏱️ 30m`)
- [ ] Core: Parse sub-task checkboxes (indented `- [ ]` or `- [x]`)
- [ ] Core: Calculate sub-task progress (completed/total, percentage)
- [ ] Webview UI: Display metadata badges on cards
- [ ] Webview UI: Color-code due dates (overdue=red, today=orange, upcoming=yellow, future=gray)
- [ ] Webview UI: Display priority badges (HIGH=red, MED=yellow, LOW=green)
- [ ] Webview UI: Display time estimate badges (⏱️ 2h)
- [ ] Webview UI: Render sub-tasks with checkboxes
- [ ] Webview UI: Show progress bar for sub-tasks (e.g., "2/5 - 40%")
- [ ] Webview UI: Make sub-task checkboxes interactive
- [ ] Extension: Handle `toggleSubTask` messages
- [ ] Extension: Update markdown sub-task line (toggle `[ ]` ↔ `[x]`)

**Deliverable:** Cards display all metadata (due dates, priority, time estimates). Sub-tasks are interactive with progress tracking.

**Acceptance Criteria:**
- ✅ Due date badges show correct color based on date proximity
- ✅ Priority badges display with correct color (high/medium/low)
- ✅ Time estimates display as badges
- ✅ Sub-tasks appear below main task with checkboxes
- ✅ Clicking sub-task checkbox updates markdown file
- ✅ Progress bar updates when sub-tasks are toggled

---

### Phase 4: Views & Filtering (Week 4-5)
**Goal:** Multiple board views (Standard, Swimlane, Backlog) with filtering

**Tasks:**
- [ ] Webview UI: Create view switcher toolbar (Standard / Swimlane / Backlog buttons)
- [ ] Webview UI: Implement Standard view (current 3-column layout, all tasks)
- [ ] Webview UI: Implement Swimlane view (group by day, each day has 3 columns, collapsible)
- [ ] Webview UI: Implement Backlog view (6 priority buckets: Now, Next 2 Weeks, This Month, This Quarter, This Year, Parking Lot)
- [ ] Core: Extract available days from day sections
- [ ] Core: Extract available projects from inline tags
- [ ] Webview UI: Add filter controls (filter by day dropdown)
- [ ] Webview UI: Add filter controls (filter by project dropdown)
- [ ] Webview UI: Add sort controls (by day, by project, by priority, by due date, by time estimate)
- [ ] Extension: Persist view preference to workspace state

**Deliverable:** Three distinct board views. Users can filter by day/project and sort by various criteria.

**Acceptance Criteria:**
- ✅ View switcher toggles between Standard/Swimlane/Backlog
- ✅ Standard view shows all tasks in 3 columns
- ✅ Swimlane view groups tasks by day, each with 3 columns
- ✅ Swimlane days are collapsible/expandable
- ✅ Backlog view shows 6 priority buckets
- ✅ Filter by day works in Standard and Swimlane views
- ✅ Filter by project works in all views
- ✅ Sort options reorder cards correctly
- ✅ View preference persists when closing/reopening board

---

### Phase 5: Context Menu & CRUD Operations (Week 5-6)
**Goal:** Full task management via right-click context menu

**Tasks:**
- [ ] Webview UI: Implement right-click context menu on cards
- [ ] Webview UI: Context menu items (see below)
- [ ] Extension: `openInMarkdown` - Jump to task line in markdown editor
- [ ] Extension: `editTitle` - Prompt for new title, update markdown
- [ ] Extension: `editDueDate` - Prompt for date (YYYY-MM-DD), validate, update markdown
- [ ] Extension: `editTimeEstimate` - Prompt for estimate (2h, 30m), validate, update markdown
- [ ] Extension: `editDescription` - Open temp editor for multi-line body, update markdown
- [ ] Extension: `setPriority` - Submenu (High/Medium/Low/None), update markdown
- [ ] Extension: `changeState` - Submenu (Todo/In Progress/Done), update markdown
- [ ] Extension: `moveToDay` - Submenu (list all days), move task to day section in markdown
- [ ] Extension: `moveToBacklogSection` - Submenu (Now/Next 2 Weeks/This Month/etc.), move task
- [ ] Extension: `moveToNextWeek` - Move task to Monday of next week
- [ ] Extension: `moveToWeek` - Prompt for week number, move task
- [ ] Extension: `deleteTask` - Show confirmation dialog, delete from markdown
- [ ] Extension: Quick add button (+ icon in toolbar)

**Context Menu Structure:**
```
Open in Markdown
---
Edit Title...
Edit Due Date...
Edit Time Estimate...
Edit Description...
---
Set Priority >
  High
  Medium
  Low
  None
---
Change State >
  Todo
  In Progress
  Done
---
Move to Day >
  Monday
  Tuesday
  Wednesday
  Thursday
  Friday
---
Move to Backlog >
  Now
  Next 2 Weeks
  This Month
  This Quarter
  This Year
  Parking Lot
---
Move to Next Week
Move to Week...
---
Delete Task...
```

**Deliverable:** Complete CRUD operations from the board via context menu. Quick add button for new tasks.

**Acceptance Criteria:**
- ✅ Right-click on card shows context menu
- ✅ "Open in Markdown" jumps to task line in editor
- ✅ Edit dialogs validate input and update markdown correctly
- ✅ Set Priority updates priority markers in markdown
- ✅ Move to Day moves task to correct day section
- ✅ Move to Backlog moves task to correct backlog bucket
- ✅ Delete shows confirmation and removes task
- ✅ Quick add (+) button creates new task in current day

---

### Phase 6: Week Navigation (Week 6-7)
**Goal:** Navigate between weeks, auto-create week files

**Tasks:**
- [ ] Extension: Parse `week` and `year` from frontmatter
- [ ] Webview UI: Add week navigation toolbar (◀ Previous Week | Week N, YYYY | Next Week ▶)
- [ ] Extension: Handle `navigateWeek` messages (direction: -1 or +1)
- [ ] Core: Install date-fns library
- [ ] Core: ISO 8601 week date calculations using date-fns (getISOWeek, startOfISOWeek, etc.)
- [ ] Core: Handle year boundaries (week 52 → week 1, week 1 → week 52)
- [ ] Extension: Read `hexfield-deck.weekFilePattern` setting
- [ ] Extension: Read `hexfield-deck.plannerRoot` setting
- [ ] Extension: Construct target file path from pattern
- [ ] Extension: Check if target week file exists
- [ ] Extension: If not exists, create directory + file from template
- [ ] Core: Generate week template using date-fns for date calculations
- [ ] Extension: Open target week file, update current file path, refresh board
- [ ] Extension: Move task to next week (extract task, insert into next week's Monday)
- [ ] Extension: Move task to specific week (prompt for week number)

**Deliverable:** Navigate forward/backward through weeks. Auto-create week files from template. Move tasks between weeks.

**Acceptance Criteria:**
- ✅ Week navigation toolbar shows current week and year
- ✅ Click "Next Week" navigates to next week
- ✅ Click "Previous Week" navigates to previous week
- ✅ If week file doesn't exist, it's created from template
- ✅ Template includes correct dates for all weekdays
- ✅ "Move to Next Week" moves task to Monday of next week
- ✅ "Move to Week..." prompts for week number and moves task
- ✅ Year boundaries handled correctly (week 52 → 1)

---

### Phase 7: Polish & Production Ready (Week 7-8)
**Goal:** Settings, testing, documentation for v1.0.0 release

**Tasks:**
- [ ] Settings: `hexfield-deck.projects` (project colors and links)
- [ ] Settings: `hexfield-deck.defaultView` (standard/swimlane/backlog)
- [ ] Settings: `hexfield-deck.showDayBadges` (boolean)
- [ ] Settings: `hexfield-deck.showMetadataBadges` (boolean)
- [ ] Settings: `hexfield-deck.autoCollapseSwimlaneDays` (boolean)
- [ ] Webview UI: Apply project colors to card borders
- [ ] Webview UI: Make project tags clickable (open link if configured)
- [ ] Extension: Dirty file protection (warn if unsaved changes before modifying)
- [ ] Extension: Show "Save Now" button in warning dialog
- [ ] Testing: Unit tests for core parser (frontmatter, tasks, metadata)
- [ ] Testing: Unit tests for date utilities (ISO week calculations)
- [ ] Testing: Integration tests for extension commands
- [ ] Documentation: Update USER_GUIDE.md with final screenshots
- [ ] Documentation: Create README.md with installation and quick start
- [ ] Documentation: Create CHANGELOG.md
- [ ] Package: Create extension icon and banner
- [ ] Package: Prepare for VS Code Marketplace publishing

**Deliverable:** Production-ready v1.0.0 extension with full settings, tests, and documentation.

**Acceptance Criteria:**
- ✅ Settings UI in VS Code allows customizing all preferences
- ✅ Project colors apply to card borders
- ✅ Clicking project tag opens configured URL
- ✅ Dirty file protection prevents data loss
- ✅ Core package has >80% test coverage
- ✅ All extension commands have integration tests
- ✅ USER_GUIDE.md is complete and accurate
- ✅ README.md has clear installation and usage instructions
- ✅ Extension passes VS Code Marketplace validation

---

### Phase 8: Obsidian Plugin (Future)
**Goal:** Dual-platform support (VS Code + Obsidian)

**Tasks:**
- [ ] Create `obsidian-plugin` package in monorepo
- [ ] Adapt extension to Obsidian plugin API
- [ ] Reuse `core` package (parser, models, utilities)
- [ ] Reuse webview UI components (React)
- [ ] Implement Obsidian file I/O (Vault API)
- [ ] Implement Obsidian settings UI
- [ ] Test on Obsidian desktop
- [ ] Test on Obsidian mobile (iOS/Android)
- [ ] Create Obsidian plugin manifest
- [ ] Submit to Obsidian community plugins

**Deliverable:** Obsidian community plugin with feature parity to VS Code extension.

**Acceptance Criteria:**
- ✅ Plugin loads in Obsidian desktop and mobile
- ✅ All features work identically to VS Code extension
- ✅ Settings sync with Obsidian's settings system
- ✅ Plugin passes Obsidian community review

---

## Success Metrics

### v1.0.0 Release (End of Phase 7)
- [ ] Extension published to VS Code Marketplace
- [ ] At least 3 distinct board views (Standard, Swimlane, Backlog)
- [ ] Full CRUD operations (create, read, update, delete tasks)
- [ ] Real-time sync between markdown and board (<500ms latency)
- [ ] Week navigation with auto-creation
- [ ] Settings for project colors, view preferences
- [ ] >80% test coverage on core package
- [ ] Complete USER_GUIDE.md documentation
- [ ] Zero critical bugs in issue tracker

### Community Adoption (Post-Release)
- [ ] 100+ installs in first month
- [ ] 10+ GitHub stars
- [ ] 5+ community contributions (issues, PRs)
- [ ] Positive feedback on VS Code Marketplace (>4.0 rating)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Markdown parsing edge cases** | High | Extensive unit tests, fuzzing with real-world planner files |
| **Performance with large files** | Medium | Debounced refresh, virtualized rendering for 100+ tasks |
| **File conflicts during drag-and-drop** | High | Dirty file protection, file system watchers, conflict detection |
| **Week date calculations (ISO 8601)** | Medium | Use proven date library (date-fns), test across year boundaries |
| **React bundle size for webview** | Low | Code splitting, tree shaking with esbuild |
| **Platform API differences (VS Code vs Obsidian)** | Medium | Abstract file I/O and settings into platform adapters |

---

## Timeline Summary

| Phase | Duration | Cumulative | Key Milestone |
|-------|----------|------------|---------------|
| Phase 1 | 2 weeks | 2 weeks | Basic board viewing |
| Phase 2 | 1 week | 3 weeks | Interactive drag & drop |
| Phase 3 | 1 week | 4 weeks | Metadata & sub-tasks |
| Phase 4 | 1 week | 5 weeks | Multiple views & filtering |
| Phase 5 | 1 week | 6 weeks | Context menu CRUD |
| Phase 6 | 1 week | 7 weeks | Week navigation |
| Phase 7 | 1 week | 8 weeks | **v1.0.0 Release** |
| Phase 8 | TBD | Future | Obsidian plugin |

**Total Time to v1.0.0:** ~8 weeks

---

## Next Steps

1. ~~**Review this plan** - User feedback and approval~~ ✅
2. ~~**Set up development environment** - pnpm, TypeScript, ESLint, Prettier~~ ✅
3. ~~**Initialize monorepo** - Create package structure, configure workspaces~~ ✅
4. **Finish Phase 1** - VS Code webview: activation, webview panel, basic 3-column board

---

## Decisions Made

1. ✅ **Heading structure:** No "Daily Planner" wrapper, keep "## Backlog" as container
2. ✅ **Project specification:** Inline `#tags` only, bold text headers ignored by parser
3. ✅ **In-progress marker:** Use `- [/] Task` checkbox variant ONLY (no `#wip` tag to avoid conflicts)
4. ✅ **Date library:** Use `date-fns` (industry standard, 14M+ weekly downloads, robust ISO week calculations)
5. ✅ **Drag-and-drop library:** Use `@dnd-kit` (modern, actively maintained, better a11y and performance than react-beautiful-dnd)
6. ✅ **Parser approach:** Line-by-line state machine, zero deps (see ADR-0006)

---

**Last Updated:** 2026-02-16
**Status:** ✅ Phase 1 complete — v0.1.0-rc.1 released | 🚀 Phase 2 next
