import { describe, it, expect } from "vitest";
import { getCardLineRange } from "./lineRange.js";
import { findEndOfBlock, findSectionInsertionPoint } from "./insertionPoint.js";
import { rebuildTaskLine } from "./taskLine.js";

// ---------------------------------------------------------------------------
// getCardLineRange
// ---------------------------------------------------------------------------

describe("getCardLineRange", () => {
  it("returns single line for a card with no children", () => {
    const lines = ["- [ ] Task A", "- [ ] Task B"];
    expect(getCardLineRange(lines, 0)).toEqual([0, 1]);
  });

  it("includes indented sub-tasks and body lines", () => {
    const lines = [
      "- [ ] Task A",
      "  - [ ] Sub 1",
      "  - [ ] Sub 2",
      "- [ ] Task B",
    ];
    expect(getCardLineRange(lines, 0)).toEqual([0, 3]);
  });

  it("includes body text lines mixed with sub-tasks", () => {
    const lines = [
      "- [ ] Task A",
      "  A body note",
      "  - [ ] Sub 1",
      "- [ ] Task B",
    ];
    expect(getCardLineRange(lines, 0)).toEqual([0, 3]);
  });

  it("stops at a blank line not followed by indented content", () => {
    const lines = [
      "- [ ] Task A",
      "  - [ ] Sub 1",
      "",
      "- [ ] Task B",
    ];
    expect(getCardLineRange(lines, 0)).toEqual([0, 2]);
  });

  it("includes a blank line bridging to continued indented content", () => {
    const lines = [
      "- [ ] Task A",
      "  - [ ] Sub 1",
      "",
      "  - [ ] Sub 2",
      "- [ ] Task B",
    ];
    expect(getCardLineRange(lines, 0)).toEqual([0, 4]);
  });

  it("handles card at the end of the file", () => {
    const lines = ["- [ ] Task A", "  - [ ] Sub 1"];
    expect(getCardLineRange(lines, 0)).toEqual([0, 2]);
  });
});

// ---------------------------------------------------------------------------
// findEndOfBlock
// ---------------------------------------------------------------------------

describe("findEndOfBlock", () => {
  it("returns position after the last content line before a boundary", () => {
    const lines = ["## Row", "- [ ] Task A", "- [ ] Task B", "## Next Row"];
    expect(findEndOfBlock(lines, 0, /^#{1,2}\s/)).toBe(3);
  });

  it("excludes trailing blank lines", () => {
    const lines = ["## Row", "- [ ] Task A", "", "## Next Row"];
    expect(findEndOfBlock(lines, 0, /^#{1,2}\s/)).toBe(2);
  });

  it("returns heading + 1 for empty block", () => {
    const lines = ["## Row", "## Next Row"];
    expect(findEndOfBlock(lines, 0, /^#{1,2}\s/)).toBe(1);
  });

  it("respects the limit parameter", () => {
    const lines = ["## Row", "- [ ] Task A", "- [ ] Task B", "- [ ] Task C"];
    expect(findEndOfBlock(lines, 0, /^#{1,2}\s/, 3)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// findSectionInsertionPoint
// ---------------------------------------------------------------------------

describe("findSectionInsertionPoint", () => {
  const doc = [
    "# Board",
    "",
    "## Monday",
    "- [ ] Task A",
    "- [ ] Task B",
    "",
    "## Tuesday",
    "- [ ] Task C",
    "",
    "# Backlog",
    "",
    "## Now",
    "- [ ] Urgent",
  ];

  it("finds insertion point at end of a row", () => {
    // Monday has tasks at lines 3-4; blank at 5; insertion should be before blank
    expect(findSectionInsertionPoint(doc, "Monday")).toBe(5);
  });

  it("finds insertion point in a different board scoped by boardHeading", () => {
    expect(findSectionInsertionPoint(doc, "Now", "Backlog")).toBe(13);
  });

  it("returns null for a missing section", () => {
    expect(findSectionInsertionPoint(doc, "Wednesday")).toBeNull();
  });

  it("scopes correctly when same H2 heading exists in multiple boards", () => {
    const multiDoc = [
      "# Week 1",
      "## Monday",
      "- [ ] W1 task",
      "# Week 2",
      "## Monday",
      "- [ ] W2 task",
    ];
    expect(findSectionInsertionPoint(multiDoc, "Monday", "Week 1")).toBe(3);
    expect(findSectionInsertionPoint(multiDoc, "Monday", "Week 2")).toBe(6);
  });

  it("handles empty row (inserts at heading + 1)", () => {
    const lines = ["## Empty Row", "## Next Row"];
    expect(findSectionInsertionPoint(lines, "Empty Row")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// findSectionInsertionPoint — implicit row (sectionHeading === "")
// ---------------------------------------------------------------------------

describe("findSectionInsertionPoint with implicit row", () => {
  it("finds insertion point between H1 and first H2", () => {
    const lines = ["# Board", "- [ ] Existing", "", "## Row A", "- [ ] In Row"];
    expect(findSectionInsertionPoint(lines, "", "Board")).toBe(2);
  });

  it("finds insertion point at end of board when no H2 exists", () => {
    const lines = ["# Board", "- [ ] Task A", "- [ ] Task B"];
    expect(findSectionInsertionPoint(lines, "", "Board")).toBe(3);
  });

  it("scopes to correct board across multiple boards", () => {
    const lines = ["# A", "- [ ] In A", "# B", "- [ ] In B"];
    expect(findSectionInsertionPoint(lines, "", "A")).toBe(2);
    expect(findSectionInsertionPoint(lines, "", "B")).toBe(4);
  });

  it("returns null when board heading not found", () => {
    const lines = ["# Board", "- [ ] Task"];
    expect(findSectionInsertionPoint(lines, "", "Missing")).toBeNull();
  });

  it("skips trailing blank lines", () => {
    const lines = ["# Board", "- [ ] Task", "", "", "## Row A"];
    expect(findSectionInsertionPoint(lines, "", "Board")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// rebuildTaskLine
// ---------------------------------------------------------------------------

describe("rebuildTaskLine", () => {
  const base = {
    rawLine: "- [ ] Fix the hatch #urgent [2026-03-01] !! est:2h",
    title: "Fix the hatch",
    tags: ["urgent"],
    dueDate: "2026-03-01",
    priority: "medium",
    timeEstimate: "2h",
  };

  it("rebuilds line with no overrides (preserves all fields)", () => {
    expect(rebuildTaskLine(base, {})).toBe(
      "- [ ] Fix the hatch #urgent [2026-03-01] !! est:2h"
    );
  });

  it("overrides the title", () => {
    expect(rebuildTaskLine(base, { title: "Fix the escape pod" })).toBe(
      "- [ ] Fix the escape pod #urgent [2026-03-01] !! est:2h"
    );
  });

  it("clears dueDate with null", () => {
    expect(rebuildTaskLine(base, { dueDate: null })).toBe(
      "- [ ] Fix the hatch #urgent !! est:2h"
    );
  });

  it("clears priority with null", () => {
    expect(rebuildTaskLine(base, { priority: null })).toBe(
      "- [ ] Fix the hatch #urgent [2026-03-01] est:2h"
    );
  });

  it("clears timeEstimate with null", () => {
    expect(rebuildTaskLine(base, { timeEstimate: null })).toBe(
      "- [ ] Fix the hatch #urgent [2026-03-01] !!"
    );
  });

  it("maps priority high to !!!", () => {
    expect(rebuildTaskLine({ ...base, priority: "high" }, {})).toBe(
      "- [ ] Fix the hatch #urgent [2026-03-01] !!! est:2h"
    );
  });

  it("maps priority low to !", () => {
    expect(rebuildTaskLine({ ...base, priority: "low" }, {})).toBe(
      "- [ ] Fix the hatch #urgent [2026-03-01] ! est:2h"
    );
  });

  it("preserves the checkbox prefix from rawLine", () => {
    const done = { ...base, rawLine: "- [x] Fix the hatch" };
    expect(rebuildTaskLine(done, { title: "Fixed" })).toBe(
      "- [x] Fixed #urgent [2026-03-01] !! est:2h"
    );
  });

  it("handles a card with no metadata", () => {
    const bare = { rawLine: "- [ ] Simple task", title: "Simple task" };
    expect(rebuildTaskLine(bare, {})).toBe("- [ ] Simple task");
  });

  it("normalizes metadata order regardless of original order", () => {
    const shuffled = {
      rawLine: "- [ ] Task !!! #ai #backend est:1h [2026-01-01]",
      title: "Task",
      tags: ["ai", "backend"],
      dueDate: "2026-01-01",
      priority: "high",
      timeEstimate: "1h",
    };
    expect(rebuildTaskLine(shuffled, {})).toBe(
      "- [ ] Task #ai #backend [2026-01-01] !!! est:1h"
    );
  });

  it("renders multiple tags", () => {
    const multi = {
      rawLine: "- [ ] Task",
      title: "Task",
      tags: ["ai", "backend", "urgent"],
    };
    expect(rebuildTaskLine(multi, {})).toBe(
      "- [ ] Task #ai #backend #urgent"
    );
  });

  it("overrides tags", () => {
    expect(rebuildTaskLine(base, { tags: ["deploy", "ci"] })).toBe(
      "- [ ] Fix the hatch #deploy #ci [2026-03-01] !! est:2h"
    );
  });
});
