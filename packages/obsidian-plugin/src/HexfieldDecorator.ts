import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import type HexfieldDeckPlugin from "./main.js";

// ---------------------------------------------------------------------------
// Frontmatter detection — same as Hexfield-Text VS Code extension
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const HEXFIELD_TYPE_RE = /^type:\s*hexfield-planner\s*$/m;

function isHexfieldDocument(text: string): boolean {
  const head = text.slice(0, 2048);
  const m = FRONTMATTER_RE.exec(head);
  return m !== null && HEXFIELD_TYPE_RE.test(m[1]);
}

// ---------------------------------------------------------------------------
// Due date proximity
// ---------------------------------------------------------------------------

type Proximity = "overdue" | "today" | "soon" | "future";

function getProximity(dateStr: string): Proximity {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + "T00:00:00");
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "future";
}

// ---------------------------------------------------------------------------
// Decoration builder
// ---------------------------------------------------------------------------

interface RangeEntry {
  from: number;
  to: number;
  style: string;
}

function buildDecorationSet(text: string, plugin: HexfieldDeckPlugin): DecorationSet {
  if (!isHexfieldDocument(text)) return Decoration.none;

  const c = plugin.settings.colors;
  const ranges: RangeEntry[] = [];

  function collect(pattern: RegExp, style: string): void {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      ranges.push({ from: m.index, to: m.index + m[0].length, style });
    }
  }

  // Static tokens
  collect(/(?<!\S)#[a-zA-Z][a-zA-Z0-9_-]*/g,  `color:${c.tagColor}`);
  collect(/(?<!!)!!!(?!!)/g,                    `color:${c.priorityHigh}`);
  collect(/(?<!!)!!(?!!)/g,                     `color:${c.priorityMed}`);
  collect(/(?<!!)!(?!!)/g,                      `color:${c.priorityLow}`);
  collect(/\best:\d+(?:\.\d+)?[hm]\b/g,        `color:${c.timeEstimate}`);
  collect(/\[\/\]/g,                            `color:${c.inProgressCheckbox}`);
  collect(/^[ \t]*-[ \t]+\[x\].+/gm,           `color:${c.doneTask};text-decoration:line-through`);
  collect(/(?<!:)\/\/.*$/gm,                    `color:${c.lineComment}`);

  // Dynamic — due dates colored by proximity
  const dateRe = /\[(\d{4}-\d{2}-\d{2})\]/g;
  let dm: RegExpExecArray | null;
  while ((dm = dateRe.exec(text)) !== null) {
    const proximity = getProximity(dm[1]);
    const color = {
      overdue: c.dueDateOverdue,
      today:   c.dueDateToday,
      soon:    c.dueDateSoon,
      future:  c.dueDateFuture,
    }[proximity];
    ranges.push({ from: dm.index, to: dm.index + dm[0].length, style: `color:${color}` });
  }

  // Sort by position; larger (outer) ranges first for the same start position
  ranges.sort((a, b) => a.from - b.from || b.to - a.to);

  // Build CM6 DecorationSet — skip any range that starts inside the previous one
  const builder = new RangeSetBuilder<Decoration>();
  let cursor = 0;
  for (const r of ranges) {
    if (r.from < cursor) continue;
    builder.add(r.from, r.to, Decoration.mark({ attributes: { style: r.style } }));
    cursor = r.to;
  }

  return builder.finish();
}

// ---------------------------------------------------------------------------
// ViewPlugin factory — call once per Compartment reconfiguration
// ---------------------------------------------------------------------------

export function hexfieldDecorationExtension(plugin: HexfieldDeckPlugin): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorationSet(view.state.doc.toString(), plugin);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged) {
          this.decorations = buildDecorationSet(update.view.state.doc.toString(), plugin);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
