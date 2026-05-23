import React, { useMemo } from "react";
import { marked } from "marked";

marked.setOptions({ gfm: true });

/** Convert Obsidian-style wikilinks to standard markdown links. */
function expandWikilinks(text: string): string {
  // [[target|label]] → [label](target)
  // [[target]]       → [target](target)
  return text.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_m, target, label) =>
    `[${label || target}](${target})`,
  );
}

export function MarkdownTitle({ title }: { title: string }) {
  const html = useMemo(() => marked.parseInline(expandWikilinks(title)) as string, [title]);

  return (
    <div
      className="card-title"
      dangerouslySetInnerHTML={{ __html: html }}
      onPointerDown={(e) => {
        // Prevent @dnd-kit drag from firing when the user clicks a link
        if ((e.target as HTMLElement).closest("a")) e.stopPropagation();
      }}
    />
  );
}
