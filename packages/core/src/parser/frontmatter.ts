import type { Frontmatter } from "../models/types.js";

/**
 * Parse YAML frontmatter from the top of a markdown file.
 * Expects `---` fences. Returns null if no frontmatter found.
 */
export function parseFrontmatter(lines: string[]): {
  frontmatter: Frontmatter | null;
  bodyStartLine: number;
} {
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { frontmatter: null, bodyStartLine: 0 };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: null, bodyStartLine: 0 };
  }

  const kvLines = lines.slice(1, endIndex);
  const raw: Record<string, string> = {};

  for (const line of kvLines) {
    const match = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (match) {
      raw[match[1]] = match[2].trim();
    }
  }

  const tags = parseArray(raw["tags"]);

  const frontmatter: Frontmatter = {
    week: Number(raw["week"]) || 0,
    year: Number(raw["year"]) || 0,
    tags,
    ...(raw["quarter"] ? { quarter: raw["quarter"] } : {}),
    ...(raw["startDate"] ? { startDate: raw["startDate"] } : {}),
    ...(raw["endDate"] ? { endDate: raw["endDate"] } : {}),
  };

  return { frontmatter, bodyStartLine: endIndex + 1 };
}

/** Parse `[a, b, c]` or `a, b, c` into a string array. */
function parseArray(value: string | undefined): string[] {
  if (!value) return [];
  // Strip surrounding brackets
  let inner = value;
  if (inner.startsWith("[") && inner.endsWith("]")) {
    inner = inner.slice(1, -1);
  }
  return inner
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
