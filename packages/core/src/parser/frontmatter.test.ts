import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses valid frontmatter with all fields", () => {
    const lines = [
      "---",
      "week: 6",
      "year: 2026",
      "tags: [planner, weekly]",
      "quarter: Q1",
      "startDate: 2026-02-02",
      "endDate: 2026-02-08",
      "---",
      "# My Week",
    ];
    const { frontmatter, bodyStartLine } = parseFrontmatter(lines);
    expect(frontmatter).toEqual({
      week: 6,
      year: 2026,
      tags: ["planner", "weekly"],
      quarter: "Q1",
      startDate: "2026-02-02",
      endDate: "2026-02-08",
    });
    expect(bodyStartLine).toBe(8);
  });

  it("parses minimal frontmatter (week, year, tags only)", () => {
    const lines = ["---", "week: 3", "year: 2026", "tags: [planner]", "---"];
    const { frontmatter } = parseFrontmatter(lines);
    expect(frontmatter).toEqual({
      week: 3,
      year: 2026,
      tags: ["planner"],
    });
  });

  it("returns null for missing frontmatter", () => {
    const lines = ["# No frontmatter here", "Some content"];
    const { frontmatter, bodyStartLine } = parseFrontmatter(lines);
    expect(frontmatter).toBeNull();
    expect(bodyStartLine).toBe(0);
  });

  it("returns null for empty input", () => {
    const { frontmatter, bodyStartLine } = parseFrontmatter([]);
    expect(frontmatter).toBeNull();
    expect(bodyStartLine).toBe(0);
  });

  it("returns null when closing fence is missing", () => {
    const lines = ["---", "week: 1", "year: 2026"];
    const { frontmatter } = parseFrontmatter(lines);
    expect(frontmatter).toBeNull();
  });

  it("handles tags without brackets", () => {
    const lines = ["---", "week: 1", "year: 2026", "tags: planner, weekly", "---"];
    const { frontmatter } = parseFrontmatter(lines);
    expect(frontmatter?.tags).toEqual(["planner", "weekly"]);
  });

  it("handles empty tags", () => {
    const lines = ["---", "week: 1", "year: 2026", "tags: []", "---"];
    const { frontmatter } = parseFrontmatter(lines);
    expect(frontmatter?.tags).toEqual([]);
  });
});
