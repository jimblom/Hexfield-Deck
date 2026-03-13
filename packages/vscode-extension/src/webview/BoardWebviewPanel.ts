import * as vscode from "vscode";
import { parseBoard, allCards } from "@hexfield-deck/core";
// @ts-expect-error — esbuild bundles CSS as a text string via --loader:.css=text
import stylesContent from "./styles.css";

export class BoardWebviewPanel {
  public static currentPanel: BoardWebviewPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _document: vscode.TextDocument;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._document = document;

    // Set initial HTML
    this._panel.webview.html = this._getHtmlForWebview();

    // Listen to configuration changes
    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (
          e.affectsConfiguration("hexfield.colors") ||
          e.affectsConfiguration("hexfield-deck.projects")
        ) {
          this._update();
        }
      },
      null,
      this._disposables,
    );

    // Listen to document changes
    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === this._document.uri.toString()) {
          this._update();
        }
      },
      null,
      this._disposables,
    );

    // Listen to messages from webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "ready":
            this._update();
            break;
          case "moveCard":
            this._handleMoveCard(message.cardId, message.newStatus);
            break;
          case "moveCardToSection":
            this._handleMoveCardToSection(
              message.cardId,
              message.sectionHeading,
              message.boardHeading,
              message.newStatus,
            );
            break;
          case "toggleSubTask":
            this._handleToggleSubTask(message.lineNumber);
            break;
          case "openInMarkdown":
            this._handleOpenInMarkdown(message.cardId);
            break;
          case "editTitle":
            this._handleEditTitle(message.cardId);
            break;
          case "editDueDate":
            this._handleEditDueDate(message.cardId);
            break;
          case "editTimeEstimate":
            this._handleEditTimeEstimate(message.cardId);
            break;
          case "setPriority":
            this._handleSetPriority(message.cardId, message.priority);
            break;
          case "deleteTask":
            this._handleDeleteTask(message.cardId);
            break;
          case "addTask":
            this._handleAddTask(message.sectionHeading, message.boardHeading);
            break;
          case "openLink":
            if (message.url && typeof message.url === "string") {
              vscode.env.openExternal(vscode.Uri.parse(message.url));
            }
            break;
          case "updateProjectConfig":
            if (message.projects && typeof message.projects === "object") {
              vscode.workspace
                .getConfiguration("hexfield-deck")
                .update("projects", message.projects, vscode.ConfigurationTarget.Global);
            }
            break;
        }
      },
      null,
      this._disposables,
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
  ): void {
    if (BoardWebviewPanel.currentPanel) {
      BoardWebviewPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);

      if (
        BoardWebviewPanel.currentPanel._document.uri.toString() !==
        document.uri.toString()
      ) {
        BoardWebviewPanel.currentPanel._document = document;
        BoardWebviewPanel.currentPanel._update();
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "hexfieldDeckBoard",
      "Hexfield Deck",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist"),
        ],
      },
    );

    BoardWebviewPanel.currentPanel = new BoardWebviewPanel(
      panel,
      extensionUri,
      document,
    );
  }

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview.js"),
    );

    const nonce = this._getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Hexfield Deck</title>
  <style>${stylesContent}</style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private _getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private _getColors(): Record<string, string> {
    const cfg = vscode.workspace.getConfiguration("hexfield.colors");
    return {
      projectTag: cfg.get<string>("projectTag", "#569CD6"),
      priorityHigh: cfg.get<string>("priorityHigh", "#F44747"),
      priorityMed: cfg.get<string>("priorityMed", "#CCA700"),
      priorityLow: cfg.get<string>("priorityLow", "#89D185"),
      timeEstimate: cfg.get<string>("timeEstimate", "#4EC9B0"),
      inProgressCheckbox: cfg.get<string>("inProgressCheckbox", "#CE9178"),
      dueDateOverdue: cfg.get<string>("dueDateOverdue", "#F44747"),
      dueDateToday: cfg.get<string>("dueDateToday", "#CE9178"),
      dueDateSoon: cfg.get<string>("dueDateSoon", "#CCA700"),
      dueDateFuture: cfg.get<string>("dueDateFuture", "#858585"),
    };
  }

  private _getProjectConfig(): Record<string, { color?: string; url?: string }> {
    return vscode.workspace
      .getConfiguration("hexfield-deck")
      .get<Record<string, { color?: string; url?: string }>>("projects", {});
  }

  private _update(): void {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);

    this._panel.webview.postMessage({
      type: "update",
      boardData: board,
      cards: cards,
      isDirty: this._document.isDirty,
      colors: this._getColors(),
      projects: this._getProjectConfig(),
    });
  }

  private async _handleMoveCard(cardId: string, newStatus: string): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);

    const card = cards.find((c) => c.id === cardId);
    if (!card) {
      vscode.window.showErrorMessage(`Card not found: ${cardId}`);
      return;
    }

    const checkboxMap: Record<string, string> = {
      "todo": "[ ]",
      "in-progress": "[/]",
      "done": "[x]",
      "wont-do": "[-]",
      "blocked": "[!]",
    };

    const newCheckbox = checkboxMap[newStatus];
    if (!newCheckbox) {
      vscode.window.showErrorMessage(`Invalid status: ${newStatus}`);
      return;
    }

    const lines = text.split("\n");
    const lineIndex = card.lineNumber - 1;
    const oldLine = lines[lineIndex];
    const newLine = oldLine.replace(/^(\s*-\s*)\[[x /!-]\]/, `$1${newCheckbox}`);

    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(lineIndex, 0, lineIndex, oldLine.length);
    edit.replace(this._document.uri, range, newLine);
    await vscode.workspace.applyEdit(edit);
  }

  /**
   * Get the full line range of a card (title line + indented children/body).
   * Returns [startIndex, endIndex) in 0-based line indices.
   */
  private _getCardLineRange(lines: string[], cardLineIndex: number): [number, number] {
    const start = cardLineIndex;
    let end = start + 1;

    const titleIndent = lines[start].match(/^(\s*)/)?.[1].length ?? 0;

    while (end < lines.length) {
      const line = lines[end];
      if (line.trim() === "") {
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

  /**
   * Find the insertion point at the end of a heading block.
   * headingIndex: 0-based line index of the heading line.
   * boundaryPattern: pattern that signals the end of this block.
   * limit: upper bound on line index to search (default: end of file).
   */
  private _findEndOfBlock(
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
   * Find the 0-based insertion point for a card in a target row.
   *
   * sectionHeading: the H2 row heading to target.
   * boardHeading:   the H1 board heading to scope the search (optional but recommended
   *                 when the same H2 heading might appear in multiple boards).
   */
  private _findSectionInsertionPoint(
    lines: string[],
    sectionHeading: string,
    boardHeading?: string,
  ): number | null {
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let searchStart = 0;
    let searchEnd = lines.length;

    // If a board heading is provided, narrow the search to within that H1 block
    if (boardHeading) {
      const h1Pattern = new RegExp(`^#\\s+${escapeRe(boardHeading)}\\s*$`, "i");
      for (let i = 0; i < lines.length; i++) {
        if (!h1Pattern.test(lines[i])) continue;
        searchStart = i + 1;
        // Find end of this H1 block (before the next # heading)
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
      // Found the H2 — insert at end of this row block (before next # or ## heading)
      return this._findEndOfBlock(lines, i, /^#{1,2}\s/, searchEnd);
    }

    return null;
  }

  private async _handleMoveCardToSection(
    cardId: string,
    sectionHeading: string,
    boardHeading: string,
    newStatus?: string,
  ): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);

    const card = cards.find((c) => c.id === cardId);
    if (!card) {
      vscode.window.showErrorMessage(`Card not found: ${cardId}`);
      return;
    }

    const lines = text.split("\n");
    const cardLineIndex = card.lineNumber - 1;
    const [rangeStart, rangeEnd] = this._getCardLineRange(lines, cardLineIndex);

    // Extract card lines, optionally updating the checkbox status
    const cardLines = lines.slice(rangeStart, rangeEnd).map((line, i) => {
      if (i === 0 && newStatus) {
        const checkboxMap: Record<string, string> = {
          "todo": "[ ]",
          "in-progress": "[/]",
          "done": "[x]",
          "wont-do": "[-]",
        };
        const newCheckbox = checkboxMap[newStatus];
        if (newCheckbox) {
          return line.replace(/^(\s*-\s*)\[[x /!-]\]/, `$1${newCheckbox}`);
        }
      }
      return line;
    });

    const insertAt = this._findSectionInsertionPoint(lines, sectionHeading, boardHeading);
    if (insertAt === null) {
      vscode.window.showErrorMessage(`Section not found: ${sectionHeading}`);
      return;
    }

    const newLines = [...lines];
    newLines.splice(rangeStart, rangeEnd - rangeStart);

    let adjustedInsertAt = insertAt;
    if (rangeStart < insertAt) {
      adjustedInsertAt -= (rangeEnd - rangeStart);
    }

    newLines.splice(adjustedInsertAt, 0, ...cardLines);

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      0, 0,
      lines.length - 1, lines[lines.length - 1].length,
    );
    edit.replace(this._document.uri, fullRange, newLines.join("\n"));
    await vscode.workspace.applyEdit(edit);
  }

  private async _handleToggleSubTask(lineNumber: number): Promise<void> {
    const text = this._document.getText();
    const lines = text.split("\n");
    const lineIndex = lineNumber - 1;
    const oldLine = lines[lineIndex];

    if (!oldLine) return;

    // Cycle: [ ] → [/] → [x] → [ ]
    let newLine: string;
    if (/\[x\]/.test(oldLine)) {
      newLine = oldLine.replace("[x]", "[ ]");
    } else if (/\[\/\]/.test(oldLine)) {
      newLine = oldLine.replace("[/]", "[x]");
    } else {
      newLine = oldLine.replace("[ ]", "[/]");
    }

    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(lineIndex, 0, lineIndex, oldLine.length);
    edit.replace(this._document.uri, range, newLine);
    await vscode.workspace.applyEdit(edit);
  }

  /**
   * Reconstruct a task line from card fields + optional overrides.
   * Normalizes metadata order: title #project [date] !!! est:Xh
   */
  private _rebuildTaskLine(
    card: { rawLine: string; title: string; project?: string; dueDate?: string; priority?: string; timeEstimate?: string },
    overrides: { title?: string; project?: string; dueDate?: string | null; priority?: string | null; timeEstimate?: string | null },
  ): string {
    const prefixMatch = card.rawLine.match(/^(\s*-\s*\[[x /!-]\]\s*)/);
    const prefix = prefixMatch ? prefixMatch[1] : "- [ ] ";

    const title = overrides.title !== undefined ? overrides.title : card.title;
    const project = overrides.project !== undefined ? overrides.project : card.project;
    const dueDate = overrides.dueDate !== undefined ? overrides.dueDate : card.dueDate;
    const priority = overrides.priority !== undefined ? overrides.priority : card.priority;
    const timeEstimate = overrides.timeEstimate !== undefined ? overrides.timeEstimate : card.timeEstimate;

    const priorityMap: Record<string, string> = { high: "!!!", medium: "!!", low: "!" };

    let line = prefix + title;
    if (project) line += ` #${project}`;
    if (dueDate) line += ` [${dueDate}]`;
    if (priority && priorityMap[priority]) line += ` ${priorityMap[priority]}`;
    if (timeEstimate) line += ` est:${timeEstimate}`;

    return line;
  }

  private async _handleOpenInMarkdown(cardId: string): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const lineIndex = card.lineNumber - 1;
    const editor = await vscode.window.showTextDocument(this._document, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });
    const pos = new vscode.Position(lineIndex, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }

  private async _handleEditTitle(cardId: string): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const newTitle = await vscode.window.showInputBox({
      value: card.title,
      prompt: "Edit task title",
      placeHolder: "Task title",
    });
    if (newTitle === undefined || newTitle === card.title) return;

    const lines = text.split("\n");
    const lineIndex = card.lineNumber - 1;
    const newLine = this._rebuildTaskLine(card, { title: newTitle });

    const edit = new vscode.WorkspaceEdit();
    edit.replace(this._document.uri, new vscode.Range(lineIndex, 0, lineIndex, lines[lineIndex].length), newLine);
    await vscode.workspace.applyEdit(edit);
  }

  private async _handleEditDueDate(cardId: string): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const newDate = await vscode.window.showInputBox({
      value: card.dueDate ?? "",
      prompt: "Due date (YYYY-MM-DD), or leave empty to clear",
      placeHolder: "YYYY-MM-DD",
      validateInput: (val) => {
        if (val === "") return undefined;
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return undefined;
        return "Enter a date as YYYY-MM-DD, or leave empty to clear";
      },
    });
    if (newDate === undefined) return;

    const lines = text.split("\n");
    const lineIndex = card.lineNumber - 1;
    const newLine = this._rebuildTaskLine(card, { dueDate: newDate || null });

    const edit = new vscode.WorkspaceEdit();
    edit.replace(this._document.uri, new vscode.Range(lineIndex, 0, lineIndex, lines[lineIndex].length), newLine);
    await vscode.workspace.applyEdit(edit);
  }

  private async _handleEditTimeEstimate(cardId: string): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const newEst = await vscode.window.showInputBox({
      value: card.timeEstimate ?? "",
      prompt: "Time estimate (e.g. 2h, 30m), or leave empty to clear",
      placeHolder: "2h",
    });
    if (newEst === undefined) return;

    const lines = text.split("\n");
    const lineIndex = card.lineNumber - 1;
    const newLine = this._rebuildTaskLine(card, { timeEstimate: newEst || null });

    const edit = new vscode.WorkspaceEdit();
    edit.replace(this._document.uri, new vscode.Range(lineIndex, 0, lineIndex, lines[lineIndex].length), newLine);
    await vscode.workspace.applyEdit(edit);
  }

  private async _handleSetPriority(cardId: string, priority: string): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const lines = text.split("\n");
    const lineIndex = card.lineNumber - 1;
    const newPriority = priority === "none" ? null : priority;
    const newLine = this._rebuildTaskLine(card, { priority: newPriority });

    const edit = new vscode.WorkspaceEdit();
    edit.replace(this._document.uri, new vscode.Range(lineIndex, 0, lineIndex, lines[lineIndex].length), newLine);
    await vscode.workspace.applyEdit(edit);
  }

  private async _handleDeleteTask(cardId: string): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const confirmed = await vscode.window.showWarningMessage(
      `Delete "${card.title}"?`,
      { modal: true },
      "Delete",
    );
    if (confirmed !== "Delete") return;

    const lines = text.split("\n");
    const cardLineIndex = card.lineNumber - 1;
    const [rangeStart, rangeEnd] = this._getCardLineRange(lines, cardLineIndex);

    const edit = new vscode.WorkspaceEdit();
    const startPos = new vscode.Position(rangeStart, 0);
    let endPos: vscode.Position;
    if (rangeEnd < lines.length) {
      endPos = new vscode.Position(rangeEnd, 0);
    } else {
      endPos = new vscode.Position(rangeEnd - 1, lines[rangeEnd - 1].length);
      const adjustedStart = rangeStart > 0
        ? new vscode.Position(rangeStart - 1, lines[rangeStart - 1].length)
        : startPos;
      edit.delete(this._document.uri, new vscode.Range(adjustedStart, endPos));
      await vscode.workspace.applyEdit(edit);
      return;
    }
    edit.delete(this._document.uri, new vscode.Range(startPos, endPos));
    await vscode.workspace.applyEdit(edit);
  }

  private async _handleAddTask(sectionHeading?: string, boardHeading?: string): Promise<void> {
    const title = await vscode.window.showInputBox({
      prompt: "New task title",
      placeHolder: "What needs doing?",
    });
    if (!title || !sectionHeading) return;

    const text = this._document.getText();
    const lines = text.split("\n");
    const newTaskLine = `- [ ] ${title}`;

    const insertAt = this._findSectionInsertionPoint(lines, sectionHeading, boardHeading);
    if (insertAt === null) {
      vscode.window.showErrorMessage(`Section not found: ${sectionHeading}`);
      return;
    }

    const edit = new vscode.WorkspaceEdit();
    const insertPos = new vscode.Position(insertAt, 0);
    edit.insert(this._document.uri, insertPos, `${newTaskLine}\n`);
    await vscode.workspace.applyEdit(edit);
  }

  public dispose(): void {
    BoardWebviewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
