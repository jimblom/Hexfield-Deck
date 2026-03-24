/**
 * Returns the [start, end) line range (0-based) for a card and its indented
 * children (body lines, sub-tasks). `end` is exclusive.
 */
export function getCardLineRange(lines: string[], cardLineIndex: number): [number, number] {
  const start = cardLineIndex;
  let end = start + 1;

  const titleIndent = lines[start].match(/^(\s*)/)?.[1].length ?? 0;

  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "") {
      // A blank line is included only if the next non-blank line is still indented
      if (end + 1 < lines.length) {
        const nextIndent = lines[end + 1].match(/^(\s*)/)?.[1].length ?? 0;
        if (nextIndent > titleIndent) {
          end++;
          continue;
        }
      }
      break;
    }
    const lineIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (lineIndent <= titleIndent) break;
    end++;
  }

  return [start, end];
}
