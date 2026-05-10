import { describe, it, expect } from "vitest";
import {
  extractProject,
  extractDueDate,
  extractPriority,
  extractTimeEstimate,
  extractComment,
  extractTags,
  parseAllMetadata,
} from "./metadata.js";

describe("extractProject", () => {
  it("extracts a bracketed project tag", () => {
    const { project, cleanText } = extractProject("Fix login [auth]");
    expect(project).toBe("auth");
    expect(cleanText).toBe("Fix login");
  });

  it("returns first project when multiple present", () => {
    const { project, cleanText } = extractProject("Task [alpha] see [beta]");
    expect(project).toBe("alpha");
    expect(cleanText).toBe("Task see [beta]");
  });

  it("returns undefined when no project tag", () => {
    const { project, cleanText } = extractProject("Plain task");
    expect(project).toBeUndefined();
    expect(cleanText).toBe("Plain task");
  });

  it("handles projects with hyphens and underscores", () => {
    const { project } = extractProject("Work on [my-project_v2]");
    expect(project).toBe("my-project_v2");
  });

  it("does not confuse hashtags with projects", () => {
    const { project, cleanText } = extractProject("Fix #auth login");
    expect(project).toBeUndefined();
    expect(cleanText).toBe("Fix #auth login");
  });

  it("does not extract dates as projects", () => {
    const { project } = extractProject("Ship feature [2026-03-15]");
    expect(project).toBeUndefined();
  });

  it("does not extract markdown link text as a project", () => {
    const { project, cleanText } = extractProject("[Jump to section](#overview)");
    expect(project).toBeUndefined();
    expect(cleanText).toBe("[Jump to section](#overview)");
  });

  it("does not extract single-char checkbox markers", () => {
    const { project } = extractProject("- [x] Done task");
    expect(project).toBeUndefined();
  });
});

describe("extractTags", () => {
  it("extracts a single tag", () => {
    const { tags, cleanText } = extractTags("Fix login #auth");
    expect(tags).toEqual(["auth"]);
    expect(cleanText).toBe("Fix login");
  });

  it("extracts multiple tags", () => {
    const { tags, cleanText } = extractTags("Task #alpha #beta");
    expect(tags).toEqual(["alpha", "beta"]);
    expect(cleanText).toBe("Task");
  });

  it("returns empty array when no tags", () => {
    const { tags, cleanText } = extractTags("Plain task");
    expect(tags).toEqual([]);
    expect(cleanText).toBe("Plain task");
  });

  it("handles tags with hyphens and underscores", () => {
    const { tags } = extractTags("Work on #my-tag_v2");
    expect(tags).toEqual(["my-tag_v2"]);
  });

  it("does not extract #fragment from a URL as a tag", () => {
    const { tags, cleanText } = extractTags("See https://example.com#anchor");
    expect(tags).toEqual([]);
    expect(cleanText).toBe("See https://example.com#anchor");
  });

  it("does not extract #anchor from a markdown link", () => {
    const { tags, cleanText } = extractTags("[Jump to section](#overview)");
    expect(tags).toEqual([]);
    expect(cleanText).toBe("[Jump to section](#overview)");
  });

  it("requires tag to start with a letter", () => {
    const { tags } = extractTags("Issue #123 is urgent");
    expect(tags).toEqual([]);
  });
});

describe("extractDueDate", () => {
  it("extracts bracketed date", () => {
    const { dueDate, cleanText } = extractDueDate(
      "Ship feature [2026-03-15]",
    );
    expect(dueDate).toBe("2026-03-15");
    expect(cleanText).toBe("Ship feature");
  });

  it("extracts due: prefix date", () => {
    const { dueDate, cleanText } = extractDueDate(
      "Ship feature due:2026-03-15",
    );
    expect(dueDate).toBe("2026-03-15");
    expect(cleanText).toBe("Ship feature");
  });

  it("returns undefined when no date", () => {
    const { dueDate } = extractDueDate("No date here");
    expect(dueDate).toBeUndefined();
  });
});

describe("extractPriority", () => {
  it("extracts high priority (!!!)", () => {
    const { priority, cleanText } = extractPriority("Urgent task !!!");
    expect(priority).toBe("high");
    expect(cleanText).toBe("Urgent task");
  });

  it("extracts medium priority (!!)", () => {
    const { priority } = extractPriority("Important task !!");
    expect(priority).toBe("medium");
  });

  it("extracts low priority (!)", () => {
    const { priority } = extractPriority("Minor task !");
    expect(priority).toBe("low");
  });

  it("returns undefined when no priority marker", () => {
    const { priority } = extractPriority("Normal task");
    expect(priority).toBeUndefined();
  });

  it("prioritizes !!! over !! over !", () => {
    const { priority } = extractPriority("Task !!!");
    expect(priority).toBe("high");
  });
});

describe("extractTimeEstimate", () => {
  it("extracts est:Xh format", () => {
    const { timeEstimate, cleanText } = extractTimeEstimate(
      "Build widget est:2h",
    );
    expect(timeEstimate).toBe("2h");
    expect(cleanText).toBe("Build widget");
  });

  it("extracts est:Xm format", () => {
    const { timeEstimate } = extractTimeEstimate("Quick fix est:30m");
    expect(timeEstimate).toBe("30m");
  });

  it("extracts emoji format", () => {
    const { timeEstimate } = extractTimeEstimate("Task ⏱️ 2h");
    expect(timeEstimate).toBe("2h");
  });

  it("returns undefined when no estimate", () => {
    const { timeEstimate } = extractTimeEstimate("No estimate");
    expect(timeEstimate).toBeUndefined();
  });
});

describe("parseAllMetadata", () => {
  it("extracts all metadata from a fully-tagged task", () => {
    const result = parseAllMetadata(
      "Deploy API [backend] #urgent #deploy [2026-03-01] !!! est:4h",
    );
    expect(result).toEqual({
      cleanTitle: "Deploy API",
      project: "backend",
      tags: ["urgent", "deploy"],
      dueDate: "2026-03-01",
      priority: "high",
      timeEstimate: "4h",
    });
  });

  it("returns clean title when no metadata", () => {
    const result = parseAllMetadata("Simple task");
    expect(result).toEqual({ cleanTitle: "Simple task", tags: [] });
  });

  it("handles partial metadata with tags only", () => {
    const result = parseAllMetadata("Fix bug #core #urgent !!");
    expect(result.cleanTitle).toBe("Fix bug");
    expect(result.project).toBeUndefined();
    expect(result.tags).toEqual(["core", "urgent"]);
    expect(result.priority).toBe("medium");
    expect(result.dueDate).toBeUndefined();
    expect(result.timeEstimate).toBeUndefined();
  });

  it("handles project with no tags", () => {
    const result = parseAllMetadata("Fix bug [hexfield] !!");
    expect(result.cleanTitle).toBe("Fix bug");
    expect(result.project).toBe("hexfield");
    expect(result.tags).toEqual([]);
    expect(result.priority).toBe("medium");
  });

  it("strips comment before parsing other metadata", () => {
    const result = parseAllMetadata("Fix bug [hexfield] #urgent [2026-02-10] // waiting on upstream #ignore");
    expect(result.cleanTitle).toBe("Fix bug");
    expect(result.comment).toBe("waiting on upstream #ignore");
    expect(result.project).toBe("hexfield");
    expect(result.tags).toEqual(["urgent"]);
    expect(result.dueDate).toBe("2026-02-10");
  });
});

describe("extractComment", () => {
  it("extracts a trailing comment", () => {
    const { comment, cleanText } = extractComment("Fix bug // waiting on upstream");
    expect(comment).toBe("waiting on upstream");
    expect(cleanText).toBe("Fix bug");
  });

  it("returns undefined when no comment", () => {
    const { comment, cleanText } = extractComment("Fix bug [hexfield]");
    expect(comment).toBeUndefined();
    expect(cleanText).toBe("Fix bug [hexfield]");
  });

  it("requires space before //", () => {
    const { comment, cleanText } = extractComment("See https://example.com for details");
    expect(comment).toBeUndefined();
    expect(cleanText).toBe("See https://example.com for details");
  });
});
