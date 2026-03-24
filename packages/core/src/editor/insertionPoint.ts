/**
 * Finds the insertion point at the end of a heading block (0-based line index).
 *
 * Scans forward from `headingIndex + 1` until a line matching `boundaryPattern`
 * is found or `limit` is reached. Trailing blank lines are excluded so new
 * cards are inserted before them.
 */
export function findEndOfBlock(
  lines: string[],
  headingIndex: number,
  boundaryPattern: RegExp,
  limit: number = lines.length,
): number {
  let insertAt = headingIndex + 1;

  for (let j = headingIndex + 1; j < limit; j++) {
    if (boundaryPattern.test(lines[j])) break;
    insertAt = j + 1;
  }

  // Back up past trailing blank lines
  while (insertAt > headingIndex + 1 && lines[insertAt - 1].trim() === "") {
    insertAt--;
  }

  return insertAt;
}

/**
 * Finds the 0-based insertion point for a card in a target H2 row.
 *
 * @param lines          - File split on newlines.
 * @param sectionHeading - The H2 row heading to target.
 * @param boardHeading   - The H1 board heading to scope the search (optional but
 *                         recommended when the same H2 heading may appear in
 *                         multiple boards).
 * @returns The 0-based line index at which to insert, or `null` if not found.
 */
export function findSectionInsertionPoint(
  lines: string[],
  sectionHeading: string,
  boardHeading?: string,
): number | null {
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let searchStart = 0;
  let searchEnd = lines.length;

  if (boardHeading) {
    const h1Pattern = new RegExp(`^#\\s+${escapeRe(boardHeading)}\\s*$`, "i");
    for (let i = 0; i < lines.length; i++) {
      if (!h1Pattern.test(lines[i])) continue;
      searchStart = i + 1;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#\s/.test(lines[j])) {
          searchEnd = j;
          break;
        }
      }
      break;
    }
  }

  const h2Pattern = new RegExp(`^##\\s+${escapeRe(sectionHeading)}\\s*$`, "i");

  for (let i = searchStart; i < searchEnd; i++) {
    if (!h2Pattern.test(lines[i])) continue;
    return findEndOfBlock(lines, i, /^#{1,2}\s/, searchEnd);
  }

  return null;
}
