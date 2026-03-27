import type { App as ObsidianApp, TFile } from "obsidian";
import type { HostBridge, HostState, OutboundMessage, UpdatePayload } from "@hexfield-deck/webview-ui";
import type { Card } from "@hexfield-deck/core";
import {
  getCardLineRange,
  findSectionInsertionPoint,
  rebuildTaskLine,
} from "@hexfield-deck/core";
import { promptText, promptConfirm } from "./HexfieldModal.js";
import type HexfieldDeckPlugin from "./main.js";

const CHECKBOX_MAP: Record<string, string> = {
  "todo": "[ ]",
  "in-progress": "[/]",
  "done": "[x]",
  "wont-do": "[-]",
  "blocked": "[!]",
};

export interface ObsidianBridgeDeps {
  obsApp: ObsidianApp;
  plugin: HexfieldDeckPlugin;
  getFile: () => TFile | null;
  /** Called after non-file-modifying ops (e.g. project config) to push a UI refresh. */
  reload: () => Promise<void>;
}

/**
 * HostBridge implementation for Obsidian.
 * Routes all OutboundMessage types to Obsidian APIs.
 */
export class ObsidianBridge implements HostBridge {
  private _updateHandler: ((payload: UpdatePayload) => void) | null = null;
  private _state: HostState = {};
  private _onReady: (() => void) | null = null;
  /** Cached from the most recent pushUpdate — used to resolve cardId → Card. */
  private _lastCards: Card[] = [];

  constructor(private readonly deps: ObsidianBridgeDeps) {}

  setReadyCallback(cb: () => void): void {
    this._onReady = cb;
  }

  send(message: OutboundMessage): void {
    void this._dispatch(message);
  }

  onUpdate(handler: (payload: UpdatePayload) => void): () => void {
    this._updateHandler = handler;
    return () => {
      this._updateHandler = null;
    };
  }

  getState(): HostState | null {
    return this._state;
  }

  setState(state: HostState): void {
    this._state = { ...this._state, ...state };
  }

  /** Push a fresh board payload into the mounted React UI. */
  pushUpdate(payload: UpdatePayload): void {
    this._lastCards = payload.cards;
    this._updateHandler?.(payload);
  }

  // ---------------------------------------------------------------------------

  private async _dispatch(message: OutboundMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this._onReady?.();
        break;

      case "moveCard":
        await this._moveCard(message.cardId, message.newStatus);
        break;

      case "moveCardToSection":
        await this._moveCardToSection(
          message.cardId,
          message.sectionHeading,
          message.boardHeading,
          message.newStatus,
        );
        break;

      case "toggleSubTask":
        await this._toggleSubTask(message.lineNumber);
        break;

      case "openInMarkdown":
        await this._openInMarkdown(message.cardId);
        break;

      case "editTitle":
        await this._editTitle(message.cardId);
        break;

      case "editDueDate":
        await this._editDueDate(message.cardId);
        break;

      case "editTimeEstimate":
        await this._editTimeEstimate(message.cardId);
        break;

      case "setPriority":
        await this._setPriority(message.cardId, message.priority);
        break;

      case "deleteTask":
        await this._deleteTask(message.cardId);
        break;

      case "addTask":
        await this._addTask(message.sectionHeading, message.boardHeading);
        break;

      case "openLink":
        window.open(message.url, "_blank");
        break;

      case "updateProjectConfig":
        await this._updateProjectConfig(message.projects);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers

  private _findCard(cardId: string): Card | undefined {
    return this._lastCards.find((c) => c.id === cardId);
  }

  private _file(): TFile | null {
    return this.deps.getFile();
  }

  /** Atomic read-modify-write on the active file. */
  private async _edit(fn: (lines: string[]) => string[]): Promise<void> {
    const file = this._file();
    if (!file) return;
    await this.deps.obsApp.vault.process(file, (content) => {
      const lines = content.split("\n");
      return fn(lines).join("\n");
    });
  }

  // ---------------------------------------------------------------------------
  // Handlers

  private async _moveCard(cardId: string, newStatus: string): Promise<void> {
    const card = this._findCard(cardId);
    if (!card) return;
    const newCheckbox = CHECKBOX_MAP[newStatus];
    if (!newCheckbox) return;
    await this._edit((lines) => {
      const idx = card.lineNumber - 1;
      lines[idx] = lines[idx].replace(/^(\s*-\s*)\[[x /!-]\]/, `$1${newCheckbox}`);
      return lines;
    });
  }

  private async _moveCardToSection(
    cardId: string,
    sectionHeading: string,
    boardHeading: string,
    newStatus?: string,
  ): Promise<void> {
    const card = this._findCard(cardId);
    if (!card) return;
    await this._edit((lines) => {
      const cardIdx = card.lineNumber - 1;
      const [rangeStart, rangeEnd] = getCardLineRange(lines, cardIdx);

      const cardLines = lines.slice(rangeStart, rangeEnd).map((line, i) => {
        if (i === 0 && newStatus) {
          const cb = CHECKBOX_MAP[newStatus];
          if (cb) return line.replace(/^(\s*-\s*)\[[x /!-]\]/, `$1${cb}`);
        }
        return line;
      });

      const insertAt = findSectionInsertionPoint(lines, sectionHeading, boardHeading);
      if (insertAt === null) return lines;

      const newLines = [...lines];
      newLines.splice(rangeStart, rangeEnd - rangeStart);
      const adjusted = rangeStart < insertAt ? insertAt - (rangeEnd - rangeStart) : insertAt;
      newLines.splice(adjusted, 0, ...cardLines);
      return newLines;
    });
  }

  private async _toggleSubTask(lineNumber: number): Promise<void> {
    await this._edit((lines) => {
      const idx = lineNumber - 1;
      const line = lines[idx];
      if (!line) return lines;
      if (/\[x\]/.test(line)) {
        lines[idx] = line.replace("[x]", "[ ]");
      } else if (/\[\/\]/.test(line)) {
        lines[idx] = line.replace("[/]", "[x]");
      } else {
        lines[idx] = line.replace("[ ]", "[/]");
      }
      return lines;
    });
  }

  private async _openInMarkdown(cardId: string): Promise<void> {
    const card = this._findCard(cardId);
    const file = this._file();
    if (!card || !file) return;

    const leaf = this.deps.obsApp.workspace.getLeaf("tab");
    await leaf.openFile(file);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = leaf.view as any;
    if (view?.editor) {
      const pos = { line: card.lineNumber - 1, ch: 0 };
      view.editor.setCursor(pos);
      view.editor.scrollIntoView({ from: pos, to: pos }, true);
    }
  }

  private async _editTitle(cardId: string): Promise<void> {
    const card = this._findCard(cardId);
    if (!card) return;
    const newTitle = await promptText(this.deps.obsApp, {
      title: "Edit title",
      label: "Task title",
      initial: card.title,
    });
    if (newTitle === null || newTitle === card.title) return;
    await this._edit((lines) => {
      lines[card.lineNumber - 1] = rebuildTaskLine(card, { title: newTitle });
      return lines;
    });
  }

  private async _editDueDate(cardId: string): Promise<void> {
    const card = this._findCard(cardId);
    if (!card) return;
    const result = await promptText(this.deps.obsApp, {
      title: "Edit due date",
      label: "Due date (YYYY-MM-DD, or leave empty to clear)",
      initial: card.dueDate ?? "",
      placeholder: "YYYY-MM-DD",
    });
    if (result === null) return;
    await this._edit((lines) => {
      lines[card.lineNumber - 1] = rebuildTaskLine(card, { dueDate: result || null });
      return lines;
    });
  }

  private async _editTimeEstimate(cardId: string): Promise<void> {
    const card = this._findCard(cardId);
    if (!card) return;
    const result = await promptText(this.deps.obsApp, {
      title: "Edit time estimate",
      label: "Time estimate (e.g. 2h, 30m, or leave empty to clear)",
      initial: card.timeEstimate ?? "",
      placeholder: "2h",
    });
    if (result === null) return;
    await this._edit((lines) => {
      lines[card.lineNumber - 1] = rebuildTaskLine(card, { timeEstimate: result || null });
      return lines;
    });
  }

  private async _setPriority(cardId: string, priority: string): Promise<void> {
    const card = this._findCard(cardId);
    if (!card) return;
    await this._edit((lines) => {
      lines[card.lineNumber - 1] = rebuildTaskLine(card, {
        priority: priority === "none" ? null : priority,
      });
      return lines;
    });
  }

  private async _deleteTask(cardId: string): Promise<void> {
    const card = this._findCard(cardId);
    if (!card) return;
    const confirmed = await promptConfirm(this.deps.obsApp, {
      title: "Delete task",
      message: `Delete "${card.title}"? This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    await this._edit((lines) => {
      const [start, end] = getCardLineRange(lines, card.lineNumber - 1);
      lines.splice(start, end - start);
      return lines;
    });
  }

  private async _addTask(sectionHeading?: string, boardHeading?: string): Promise<void> {
    if (!sectionHeading) return;
    const title = await promptText(this.deps.obsApp, {
      title: "New task",
      label: "Task title",
      placeholder: "What needs doing?",
    });
    if (!title) return;
    await this._edit((lines) => {
      const insertAt = findSectionInsertionPoint(lines, sectionHeading, boardHeading);
      if (insertAt === null) return lines;
      lines.splice(insertAt, 0, `- [ ] ${title}`);
      return lines;
    });
  }

  private async _updateProjectConfig(
    projects: Record<string, { color?: string; url?: string; style?: string }>,
  ): Promise<void> {
    const existing = (await this.deps.plugin.loadData()) ?? {};
    await this.deps.plugin.saveData({ ...existing, projects });
    await this.deps.reload();
  }
}
