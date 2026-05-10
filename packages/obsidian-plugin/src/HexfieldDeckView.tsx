import { ItemView, Menu, WorkspaceLeaf, TFile, ViewStateResult } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { App } from "@hexfield-deck/webview-ui";
import { parseBoard, allCards, displayLabel } from "@hexfield-deck/core";
import type { Card } from "@hexfield-deck/core";
import { ObsidianBridge } from "./ObsidianBridge.js";
import type HexfieldDeckPlugin from "./main.js";
// @ts-expect-error — esbuild bundles CSS as a text string via --loader:.css=text
import stylesContent from "@hexfield-deck/webview-ui/styles.css";

export const VIEW_TYPE = "hexfield-deck";

/**
 * CSS injected into every HexfieldDeckView instance.
 * Maps Obsidian design-system vars → --vscode-* vars consumed by webview-ui
 * components, sets default --hx-* color tokens, fixes layout for a pane
 * (not a full-page webview), and adds Obsidian-quality animations.
 */
const OBSIDIAN_OVERRIDES = `
.hexfield-deck-root {
  /* Map Obsidian vars → VS Code var names used by component styles */
  --vscode-font-family: var(--font-interface, -apple-system, BlinkMacSystemFont, sans-serif);
  --vscode-font-size: var(--font-ui-medium, 13px);
  --vscode-foreground: var(--text-normal);
  --vscode-editor-background: var(--background-primary);
  --vscode-sideBar-background: var(--background-secondary);
  --vscode-panel-border: var(--background-modifier-border);
  --vscode-descriptionForeground: var(--text-muted);
  --vscode-badge-background: var(--background-secondary-alt, var(--background-secondary));
  --vscode-button-background: var(--interactive-accent);
  --vscode-button-foreground: var(--text-on-accent, #fff);
  --vscode-button-hoverBackground: var(--interactive-accent-hover, var(--interactive-accent));
  --vscode-input-background: var(--background-modifier-form-field, var(--background-secondary));
  --vscode-input-foreground: var(--text-normal);
  --vscode-input-border: var(--background-modifier-border);
  --vscode-focusBorder: var(--color-accent, var(--interactive-accent));
  --vscode-list-hoverBackground: var(--background-modifier-hover);
  --vscode-list-activeSelectionBackground: var(--background-modifier-active-hover);
  --vscode-editorWarning-foreground: var(--color-yellow, #e5c07b);
  --vscode-editorWidget-background: var(--background-secondary);
  --vscode-widget-border: var(--background-modifier-border);
  --vscode-dropdown-background: var(--background-modifier-form-field, var(--background-secondary));
  --vscode-dropdown-border: var(--background-modifier-border);
  --vscode-scrollbarSlider-background: var(--scrollbar-thumb-bg, rgba(128,128,128,0.35));
  --vscode-scrollbarSlider-hoverBackground: rgba(128,128,128,0.6);

  /* Default --hx-* tokens; overridden per-project via Project Panel */
  --hx-project-tag: var(--color-blue, #569CD6);
  --hx-priority-high: var(--color-red, #F44747);
  --hx-priority-med: var(--color-yellow, #CCA700);
  --hx-priority-low: var(--color-green, #89D185);
  --hx-time-estimate: var(--color-cyan, #4EC9B0);
  --hx-due-overdue: var(--color-red, #F44747);
  --hx-due-today: var(--color-orange, #CE9178);
  --hx-due-soon: var(--color-yellow, #CCA700);
  --hx-due-future: var(--text-faint, #858585);
  --hx-tag-color: var(--color-purple, #BB9AF7);

  /* Pane layout: height is constrained by the leaf, not the viewport */
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  /* Theme isolation — prevent community themes (Shimmering Focus, etc.)
     from leaking line-height, text-align, or letter-spacing into the board */
  text-align: left;
  line-height: 1.4;
  letter-spacing: normal;
}

/* Belt-and-suspenders: reset on descendants too so theme rules that
   target intermediate selectors can't override the inherited values.
   Exclude SVGs (icons) which have their own coordinate system. */
.hexfield-deck-root *:not(svg):not(svg *) {
  text-align: inherit;
  line-height: inherit;
  letter-spacing: inherit;
}

/* Fix .app height for pane context (webview-ui uses 100vh) */
.hexfield-deck-root .app {
  height: 100%;
}

/* Ensure native <select> is interactive — Chromium can lose click
   responsiveness when background-color overrides the native appearance
   without a concrete value (undefined CSS vars → transparent). */
.hexfield-deck-root select.slate-selector {
  -webkit-appearance: menulist;
  appearance: menulist;
  cursor: pointer;
}

/* Card lift animation — no CSP restriction in Obsidian */
.hexfield-deck-root .card {
  transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
  will-change: transform;
}
.hexfield-deck-root .card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
}

/* Tinted badge backgrounds — each badge's inline color becomes the tint
   source via currentColor, so priority/project/date badges all auto-tint */
.hexfield-deck-root .badge {
  background: color-mix(in srgb, currentColor 10%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
}

/* Tag pills: tinted background using the tag color */
.hexfield-deck-root .tag-pill {
  background: color-mix(in srgb, var(--hx-tag-color, #BB9AF7) 12%, transparent);
}

/* Drag ghost: dnd-kit applies transform; add opacity fade */
.hexfield-deck-root .card[data-dragging="true"],
.hexfield-deck-root .card[style*="translate3d"] {
  opacity: 0.75;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
}

/* Column drop-zone highlight */
.hexfield-deck-root .column {
  transition: background 150ms ease;
}

/* Smooth slate/tab transitions */
.hexfield-deck-root .board-content {
  animation: hx-fade-in 150ms ease;
}
@keyframes hx-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

export class HexfieldDeckView extends ItemView {
  private _bridge: ObsidianBridge;
  private _root: Root | null = null;
  private _file: TFile | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: HexfieldDeckPlugin) {
    super(leaf);
    this._bridge = new ObsidianBridge({
      obsApp: this.app,
      plugin,
      getFile: () => this._file,
      reload: () => this._load(),
    });
  }

  get file(): TFile | null {
    return this._file;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return this._file?.basename ?? "Hexfield Deck";
  }

  getIcon(): string {
    return "layout-grid";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    // Inject component styles scoped to .hexfield-deck-root.
    // Transform the webview-ui CSS: scope body/universal rules so they don't
    // leak into Obsidian's UI, then prepend Obsidian var mappings.
    const scopedCSS = (stylesContent as string)
      .replace(/^body(\s*\{)/gm, ".hexfield-deck-root$1")
      .replace(/^\*(\s*\{)/gm, ".hexfield-deck-root *$1");
    const style = document.createElement("style");
    style.textContent = OBSIDIAN_OVERRIDES + "\n" + scopedCSS;
    container.appendChild(style);

    // Mount React
    const mountPoint = container.createDiv({ cls: "hexfield-deck-root" });
    this._root = createRoot(mountPoint);
    this._root.render(
      <App
        bridge={this._bridge}
        onContextMenu={(card, pos) => this._handleContextMenu(card, pos)}
      />
    );

    // Trigger initial load when App signals ready
    this._bridge.setReadyCallback(() => this._load());

    // Watch for file saves
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (file === this._file) await this._load();
      }),
    );
  }

  async onClose(): Promise<void> {
    this._root?.unmount();
    this._root = null;
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = state as { filePath?: string } | null;
    if (s?.filePath) {
      const file = this.app.vault.getFileByPath(s.filePath);
      if (file) await this.setFile(file);
    }
    await super.setState(state, result);
  }

  getState(): Record<string, unknown> {
    return { filePath: this._file?.path };
  }

  async setFile(file: TFile): Promise<void> {
    this._file = file;
    this.titleEl.setText(file.basename);
    if (this._root) await this._load();
  }

  private _buildContextMenu(card: Card): Menu {
    const menu = new Menu();
    const bd = this._bridge.getBoardData();

    // Open in Markdown
    menu.addItem((item) =>
      item
        .setTitle("Open in Markdown")
        .setIcon("file-text")
        .onClick(() => this._bridge.send({ type: "openInMarkdown", cardId: card.id }))
    );

    menu.addSeparator();

    // Edit actions
    menu.addItem((item) =>
      item
        .setTitle("Edit Title...")
        .setIcon("pencil")
        .onClick(() => this._bridge.send({ type: "editTitle", cardId: card.id }))
    );
    menu.addItem((item) =>
      item
        .setTitle("Edit Due Date...")
        .setIcon("calendar")
        .onClick(() => this._bridge.send({ type: "editDueDate", cardId: card.id }))
    );
    menu.addItem((item) =>
      item
        .setTitle("Edit Time Estimate...")
        .setIcon("clock")
        .onClick(() => this._bridge.send({ type: "editTimeEstimate", cardId: card.id }))
    );

    menu.addSeparator();

    // Priority
    const priorities: Array<[string, "high" | "medium" | "low" | "none"]> = [
      ["High", "high"],
      ["Medium", "medium"],
      ["Low", "low"],
      ["None", "none"],
    ];
    for (const [label, priority] of priorities) {
      const isCurrent = priority === "none" ? !card.priority : card.priority === priority;
      menu.addItem((item) =>
        item
          .setTitle(`Priority: ${label}`)
          .setChecked(isCurrent)
          .onClick(() => this._bridge.send({ type: "setPriority", cardId: card.id, priority }))
      );
    }

    menu.addSeparator();

    // Change State
    const states: Array<[string, string]> = [
      ["To Do", "todo"],
      ["In Progress", "in-progress"],
      ["Done", "done"],
      ["Won't Do", "wont-do"],
      ["Blocked", "blocked"],
    ];
    for (const [label, status] of states) {
      menu.addItem((item) =>
        item
          .setTitle(`State: ${label}`)
          .setChecked(card.status === status)
          .onClick(() => this._bridge.send({ type: "moveCard", cardId: card.id, newStatus: status }))
      );
    }

    // Move submenus (requires cached board data)
    if (bd) {
      menu.addSeparator();

      // Rows within the card's own board
      const homeBoard = bd.boards.find((b) => b.heading === card.boardHeading);
      if (homeBoard) {
        for (const row of homeBoard.rows) {
          if (row.heading === card.sectionHeading) continue;
          const rowLabel = row.heading ? displayLabel(row.heading) : "General";
          menu.addItem((item) =>
            item
              .setTitle(`Move: ${rowLabel}`)
              .setIcon("arrow-right")
              .onClick(() =>
                this._bridge.send({
                  type: "moveCardToSection",
                  cardId: card.id,
                  sectionHeading: row.heading,
                  boardHeading: homeBoard.heading,
                })
              )
          );
        }
      }

      // Other boards
      for (const board of bd.boards) {
        if (board.heading === card.boardHeading || board.rows.length === 0) continue;
        const boardLabel = board.heading || "Board";
        for (const row of board.rows) {
          const rowLabel = row.heading ? displayLabel(row.heading) : "General";
          menu.addItem((item) =>
            item
              .setTitle(`Move to ${boardLabel}: ${rowLabel}`)
              .setIcon("arrow-right")
              .onClick(() =>
                this._bridge.send({
                  type: "moveCardToSection",
                  cardId: card.id,
                  sectionHeading: row.heading,
                  boardHeading: board.heading,
                })
              )
          );
        }
      }
    }

    menu.addSeparator();

    // Delete
    menu.addItem((item) =>
      item
        .setTitle("Delete Task...")
        .setIcon("trash")
        .onClick(() => this._bridge.send({ type: "deleteTask", cardId: card.id }))
    );

    return menu;
  }

  private _handleContextMenu(card: Card, pos: { x: number; y: number }): void {
    this._buildContextMenu(card).showAtPosition(pos);
  }

  async _load(): Promise<void> {
    if (!this._file) return;
    const content = await this.app.vault.read(this._file);
    const boardData = parseBoard(content);
    const cards = allCards(boardData);
    const storedData = (await this.plugin.loadData()) ?? {};
    const projects = (storedData.projects as Record<string, unknown>) ?? {};
    this._bridge.pushUpdate({ boardData, cards, projects });
  }
}
