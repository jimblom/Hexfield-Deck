import type { Priority } from "../models/types.js";

export interface ExtractedMetadata {
  cleanTitle: string;
  project?: string;
  dueDate?: string;
  priority?: Priority;
  timeEstimate?: string;
}

/** Extract the first #project tag from text. */
export function extractProject(text: string): {
  project: string | undefined;
  cleanText: string;
} {
  const match = text.match(/(?:^|\s)#([a-zA-Z0-9_-]+)/);
  if (!match) return { project: undefined, cleanText: text };
  const cleanText = text.replace(match[0], "").replace(/\s{2,}/g, " ").trim();
  return { project: match[1], cleanText };
}

/** Extract a due date: `[YYYY-MM-DD]` or `due:YYYY-MM-DD`. */
export function extractDueDate(text: string): {
  dueDate: string | undefined;
  cleanText: string;
} {
  // Try bracketed form first
  const bracketMatch = text.match(/\[(\d{4}-\d{2}-\d{2})\]/);
  if (bracketMatch) {
    const cleanText = text
      .replace(bracketMatch[0], "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { dueDate: bracketMatch[1], cleanText };
  }
  // Try due: prefix
  const dueMatch = text.match(/due:(\d{4}-\d{2}-\d{2})/);
  if (dueMatch) {
    const cleanText = text
      .replace(dueMatch[0], "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { dueDate: dueMatch[1], cleanText };
  }
  return { dueDate: undefined, cleanText: text };
}

/** Extract priority: `!!!` = high, `!!` = medium, `!` = low. Longest match first. */
export function extractPriority(text: string): {
  priority: Priority | undefined;
  cleanText: string;
} {
  // Match !!! / !! / ! that aren't part of a word (not preceded by a letter)
  // Check longest first
  const tripleMatch = text.match(/(?<![a-zA-Z])!!!/);
  if (tripleMatch) {
    const cleanText = text
      .replace("!!!", "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { priority: "high", cleanText };
  }
  const doubleMatch = text.match(/(?<![a-zA-Z])!!/);
  if (doubleMatch) {
    const cleanText = text
      .replace("!!", "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { priority: "medium", cleanText };
  }
  const singleMatch = text.match(/(?<![a-zA-Z])!/);
  if (singleMatch) {
    const cleanText = text
      .replace(/(?<![a-zA-Z])!/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { priority: "low", cleanText };
  }
  return { priority: undefined, cleanText: text };
}

/** Extract time estimate: `est:2h`, `est:30m`, `⏱️ 2h`, `⏱️ 30m`. */
export function extractTimeEstimate(text: string): {
  timeEstimate: string | undefined;
  cleanText: string;
} {
  const estMatch = text.match(/est:(\d+[hm])/);
  if (estMatch) {
    const cleanText = text
      .replace(estMatch[0], "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { timeEstimate: estMatch[1], cleanText };
  }
  const emojiMatch = text.match(/⏱️\s*(\d+[hm])/);
  if (emojiMatch) {
    const cleanText = text
      .replace(emojiMatch[0], "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { timeEstimate: emojiMatch[1], cleanText };
  }
  return { timeEstimate: undefined, cleanText: text };
}

/** Run all metadata extractors in sequence. */
export function parseAllMetadata(text: string): ExtractedMetadata {
  const { project, cleanText: t1 } = extractProject(text);
  const { dueDate, cleanText: t2 } = extractDueDate(t1);
  const { priority, cleanText: t3 } = extractPriority(t2);
  const { timeEstimate, cleanText: t4 } = extractTimeEstimate(t3);
  return {
    cleanTitle: t4,
    ...(project !== undefined ? { project } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(timeEstimate !== undefined ? { timeEstimate } : {}),
  };
}
