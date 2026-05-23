/** Fields that can be overridden when rebuilding a task line. `null` clears the field. */
export interface CardOverrides {
  title?: string;
  tags?: string[];
  dueDate?: string | null;
  priority?: string | null;
  timeEstimate?: string | null;
}

/** Minimal card shape required by rebuildTaskLine. */
export interface RebuildCard {
  rawLine: string;
  title: string;
  tags?: string[];
  dueDate?: string;
  priority?: string;
  timeEstimate?: string;
}

/**
 * Reconstructs a task line from card fields + optional overrides.
 * Normalizes metadata order: `title #tag1 #tag2 [date] !!! est:Xh`
 * The checkbox prefix is preserved from `card.rawLine`.
 */
export function rebuildTaskLine(card: RebuildCard, overrides: CardOverrides): string {
  const prefixMatch = card.rawLine.match(/^(\s*-\s*\[[x /!-]\]\s*)/);
  const prefix = prefixMatch ? prefixMatch[1] : "- [ ] ";

  const title = overrides.title !== undefined ? overrides.title : card.title;
  const tags = overrides.tags !== undefined ? overrides.tags : (card.tags ?? []);
  const dueDate = overrides.dueDate !== undefined ? overrides.dueDate : card.dueDate;
  const priority = overrides.priority !== undefined ? overrides.priority : card.priority;
  const timeEstimate = overrides.timeEstimate !== undefined ? overrides.timeEstimate : card.timeEstimate;

  const priorityMap: Record<string, string> = { high: "!!!", medium: "!!", low: "!" };

  let line = prefix + title;
  for (const tag of tags) {
    line += ` #${tag}`;
  }
  if (dueDate) line += ` [${dueDate}]`;
  if (priority && priorityMap[priority]) line += ` ${priorityMap[priority]}`;
  if (timeEstimate) line += ` est:${timeEstimate}`;

  return line;
}
