import { describe, it, expect } from "vitest";
import {
  extractProject,
  extractDueDate,
  extractPriority,
  extractTimeEstimate,
  parseAllMetadata,
} from "./metadata.js";

describe("extractProject", () => {
  it("extracts a project tag", () => {
    const { project, cleanText } = extractProject("Fix login #auth");
    expect(project).toBe("auth");
    expect(cleanText).toBe("Fix login");
  });

  it("returns first tag when multiple present", () => {
    const { project } = extractProject("Task #alpha #beta");
    expect(project).toBe("alpha");
  });

  it("returns undefined when no tag", () => {
    const { project, cleanText } = extractProject("Plain task");
    expect(project).toBeUndefined();
    expect(cleanText).toBe("Plain task");
  });

  it("handles tags with hyphens and underscores", () => {
    const { project } = extractProject("Work on #my-project_v2");
    expect(project).toBe("my-project_v2");
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
    // !!! should be matched, not three separate !
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
      "Deploy API #backend [2026-03-01] !!! est:4h",
    );
    expect(result).toEqual({
      cleanTitle: "Deploy API",
      project: "backend",
      dueDate: "2026-03-01",
      priority: "high",
      timeEstimate: "4h",
    });
  });

  it("returns clean title when no metadata", () => {
    const result = parseAllMetadata("Simple task");
    expect(result).toEqual({ cleanTitle: "Simple task" });
  });

  it("handles partial metadata", () => {
    const result = parseAllMetadata("Fix bug #core !!");
    expect(result.cleanTitle).toBe("Fix bug");
    expect(result.project).toBe("core");
    expect(result.priority).toBe("medium");
    expect(result.dueDate).toBeUndefined();
    expect(result.timeEstimate).toBeUndefined();
  });
});
