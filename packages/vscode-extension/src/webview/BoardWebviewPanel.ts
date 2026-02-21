import * as vscode from "vscode";
import * as path from "path";
import { parseBoard, allCards } from "@hexfield-deck/core";
// @ts-expect-error — esbuild bundles CSS as a text string via --loader:.css=text
import stylesContent from "./styles.css";

// ---- ISO Week Utilities -----------------------------------------------------

/** Returns the UTC Date of Monday for the given ISO week and year. */
function mondayOfISOWeek(week: number, year: number): Date {
  // Jan 4 of any year is always in ISO week 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7; // Convert Sunday (0) → 7
  const mondayW1 = new Date(jan4);
  mondayW1.setUTCDate(jan4.getUTCDate() - (dow - 1));
  const result = new Date(mondayW1);
  result.setUTCDate(mondayW1.getUTCDate() + (week - 1) * 7);
  return result;
}

/** Returns the ISO week number and ISO year for a given Date. */
function getISOWeekAndYear(date: Date): { week: number; year: number } {
  // Shift to the nearest Thursday to correctly determine ISO year at boundaries.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/** Returns the number of ISO weeks in the given year (52 or 53). */
function isoWeeksInYear(year: number): number {
  // Dec 28 is always in the year's last ISO week.
  return getISOWeekAndYear(new Date(Date.UTC(year, 11, 28))).week;
}

/** Returns the ISO week and year that is `delta` weeks from the given week/year. */
function getAdjacentWeek(week: number, year: number, delta: number): { week: number; year: number } {
  const monday = mondayOfISOWeek(week, year);
  monday.setUTCDate(monday.getUTCDate() + delta * 7);
  return getISOWeekAndYear(monday);
}

/** Formats a UTC Date as "Monday, February 16, 2026". */
function formatUTCDate(date: Date): string {
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${DAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** Generates a fresh weekly planner markdown file for the given ISO week/year. */
function generateWeekTemplate(week: number, year: number): string {
  const monday = mondayOfISOWeek(week, year);
  const weekdayHeadings = [0, 1, 2, 3, 4].flatMap((offset) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + offset);
    return [`## ${formatUTCDate(d)}`, ""];
  });
  return [
    "---",
    `week: ${week}`,
    `year: ${year}`,
    "tags: [planner, weekly]",
    "---",
    "",
    ...weekdayHeadings,
    "## Backlog",
    "",
    "### Now",
    "",
    "### Next 2 Weeks",
    "",
    "### This Month",
    "",
    "## This Quarter",
    "",
    "## This Year",
    "",
    "## Parking Lot",
    "",
  ].join("\n");
}

/** Resolves a week file path from the pattern and workspace settings. */
function resolveWeekFilePath(
  week: number,
  year: number,
  pattern: string,
  plannerRoot: string,
  workspaceRoot: string,
): string {
  const WW = String(week).padStart(2, "0");
  const relative = pattern
    .replace(/\{year\}/g, String(year))
    .replace(/\{WW\}/g, WW)
    .replace(/\{week\}/g, String(week));
  const root = plannerRoot ? path.join(workspaceRoot, plannerRoot) : workspaceRoot;
  return path.join(root, relative);
}

// -----------------------------------------------------------------------------

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
            // Webview is ready, send initial data
            this._update();
            break;
          case "moveCard":
            this._handleMoveCard(message.cardId, message.newStatus);
            break;
          case "moveCardToDay":
            this._handleMoveCardToDay(message.cardId, message.targetDay, message.newStatus);
            break;
          case "moveCardToSection":
            this._handleMoveCardToSection(message.cardId, message.targetSection);
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
            this._handleAddTask(message.targetDay, message.targetSection);
            break;
          case "navigateWeek":
            this._handleNavigateWeek(message.delta);
            break;
          case "moveToNextWeek":
            this._handleMoveCardToNextWeek(message.cardId);
            break;
          case "moveToWeek":
            this._handleMoveCardToWeek(message.cardId);
            break;
          case "openLink":
            if (message.url && typeof message.url === "string") {
              vscode.env.openExternal(vscode.Uri.parse(message.url));
            }
            break;
        }
      },
      null,
      this._disposables,
    );

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
  ): void {
    // If panel exists, reveal it and update document if different
    if (BoardWebviewPanel.currentPanel) {
      BoardWebviewPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);

      // Update document reference if different file
      if (
        BoardWebviewPanel.currentPanel._document.uri.toString() !==
        document.uri.toString()
      ) {
        BoardWebviewPanel.currentPanel._document = document;
        BoardWebviewPanel.currentPanel._update();
      }
      return;
    }

    // Create new panel
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

  private _update(): void {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);

    // Send update to webview
    this._panel.webview.postMessage({
      type: "update",
      boardData: board,
      cards: cards,
      isDirty: this._document.isDirty,
    });
  }

  private async _handleMoveCard(cardId: string, newStatus: string): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);

    // Find the card
    const card = cards.find((c) => c.id === cardId);
    if (!card) {
      vscode.window.showErrorMessage(`Card not found: ${cardId}`);
      return;
    }

    // Map status to checkbox
    const checkboxMap: Record<string, string> = {
      "todo": "[ ]",
      "in-progress": "[/]",
      "done": "[x]",
    };

    const newCheckbox = checkboxMap[newStatus];
    if (!newCheckbox) {
      vscode.window.showErrorMessage(`Invalid status: ${newStatus}`);
      return;
    }

    // Get the line content
    const lines = text.split("\n");
    const lineIndex = card.lineNumber - 1; // Convert to 0-based
    const oldLine = lines[lineIndex];

    // Replace checkbox in the line
    const newLine = oldLine.replace(/^(\s*-\s*)\[[x /]\]/, `$1${newCheckbox}`);

    // Apply edit
    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(
      lineIndex,
      0,
      lineIndex,
      oldLine.length,
    );
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

    // The card's title line starts with optional whitespace + "- ["
    const titleIndent = lines[start].match(/^(\s*)/)?.[1].length ?? 0;

    // Collect all following lines that are more indented (sub-tasks, body text)
    while (end < lines.length) {
      const line = lines[end];
      // Empty lines within a card block — include if followed by indented content
      if (line.trim() === "") {
        // Peek ahead
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
   * Find the insertion point for a card in a target day section.
   * Returns the 0-based line index where the card should be inserted.
   */
  private _findDaySectionInsertionPoint(lines: string[], targetDay: string): number | null {
    // Find the ## heading that contains the target day name
    const headingPattern = new RegExp(`^##\\s+${targetDay}`, "i");

    for (let i = 0; i < lines.length; i++) {
      if (headingPattern.test(lines[i])) {
        // Found the heading — find the end of this section (next ## heading or EOF)
        let insertAt = i + 1;

        // Skip past all content in this section
        for (let j = i + 1; j < lines.length; j++) {
          if (/^##\s/.test(lines[j])) break;
          insertAt = j + 1;
        }

        // Back up past trailing blank lines to insert before them
        while (insertAt > i + 1 && lines[insertAt - 1].trim() === "") {
          insertAt--;
        }

        return insertAt;
      }
    }

    return null;
  }

  private async _handleMoveCardToDay(
    cardId: string,
    targetDay: string,
    newStatus: string,
  ): Promise<void> {
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
    };

    const newCheckbox = checkboxMap[newStatus];
    if (!newCheckbox) {
      vscode.window.showErrorMessage(`Invalid status: ${newStatus}`);
      return;
    }

    const lines = text.split("\n");
    const cardLineIndex = card.lineNumber - 1;
    const [rangeStart, rangeEnd] = this._getCardLineRange(lines, cardLineIndex);

    // Extract the card lines and update the checkbox on the title line
    const cardLines = lines.slice(rangeStart, rangeEnd).map((line, i) => {
      if (i === 0) {
        return line.replace(/^(\s*-\s*)\[[x /]\]/, `$1${newCheckbox}`);
      }
      return line;
    });

    // Find where to insert in the target section
    const insertAt = this._findDaySectionInsertionPoint(lines, targetDay);
    if (insertAt === null) {
      vscode.window.showErrorMessage(`Day section not found: ${targetDay}`);
      return;
    }

    // Build new document: remove old lines, insert at new position
    // We need to be careful about index shifting when remove happens before insert
    const newLines = [...lines];

    // Remove the old card lines first
    newLines.splice(rangeStart, rangeEnd - rangeStart);

    // Adjust insertion index if the removal was before the insertion point
    let adjustedInsertAt = insertAt;
    if (rangeStart < insertAt) {
      adjustedInsertAt -= (rangeEnd - rangeStart);
    }

    // Insert the card lines at the new position
    newLines.splice(adjustedInsertAt, 0, ...cardLines);

    // Apply as a full document replacement
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      0, 0,
      lines.length - 1, lines[lines.length - 1].length,
    );
    edit.replace(this._document.uri, fullRange, newLines.join("\n"));

    await vscode.workspace.applyEdit(edit);
  }

  /** Map section keys to their markdown heading patterns. */
  private _findSectionInsertionPoint(lines: string[], sectionKey: string): number | null {
    // Map section keys to heading text
    const sectionHeadings: Record<string, { level: number; text: string }> = {
      "now": { level: 3, text: "Now" },
      "next-2-weeks": { level: 3, text: "Next 2 Weeks" },
      "this-month": { level: 3, text: "This Month" },
      "this-quarter": { level: 2, text: "This Quarter" },
      "this-year": { level: 2, text: "This Year" },
      "parking-lot": { level: 2, text: "Parking Lot" },
    };

    const target = sectionHeadings[sectionKey];
    if (!target) return null;

    const prefix = "#".repeat(target.level);
    const headingPattern = new RegExp(`^${prefix}\\s+${target.text}`, "i");
    // The boundary is any heading at the same level or higher
    const boundaryPattern = new RegExp(`^#{1,${target.level}}\\s`);

    for (let i = 0; i < lines.length; i++) {
      if (headingPattern.test(lines[i])) {
        let insertAt = i + 1;

        for (let j = i + 1; j < lines.length; j++) {
          if (boundaryPattern.test(lines[j])) break;
          insertAt = j + 1;
        }

        while (insertAt > i + 1 && lines[insertAt - 1].trim() === "") {
          insertAt--;
        }

        return insertAt;
      }
    }

    return null;
  }

  private async _handleMoveCardToSection(
    cardId: string,
    targetSection: string,
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

    // Extract the card lines (keep checkbox as-is for section moves)
    const cardLines = lines.slice(rangeStart, rangeEnd);

    const insertAt = this._findSectionInsertionPoint(lines, targetSection);
    if (insertAt === null) {
      vscode.window.showErrorMessage(`Section not found: ${targetSection}`);
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
    const lineIndex = lineNumber - 1; // Convert to 0-based
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
  private _rebuildTaskLine(card: { rawLine: string; title: string; project?: string; dueDate?: string; priority?: string; timeEstimate?: string }, overrides: { title?: string; project?: string; dueDate?: string | null; priority?: string | null; timeEstimate?: string | null }): string {
    // Extract leading whitespace + checkbox prefix from rawLine
    const prefixMatch = card.rawLine.match(/^(\s*-\s*\[[x /]\]\s*)/);
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
    this._addCardDeleteToEdit(edit, this._document.uri, lines, rangeStart, rangeEnd);
    await vscode.workspace.applyEdit(edit);
  }

  /**
   * Adds a delete operation for a card block to an existing WorkspaceEdit.
   * Handles edge case where the card is at the end of the file.
   */
  private _addCardDeleteToEdit(
    edit: vscode.WorkspaceEdit,
    uri: vscode.Uri,
    lines: string[],
    rangeStart: number,
    rangeEnd: number,
  ): void {
    const startPos = new vscode.Position(rangeStart, 0);
    if (rangeEnd < lines.length) {
      edit.delete(uri, new vscode.Range(startPos, new vscode.Position(rangeEnd, 0)));
    } else {
      // Card is at the end of the file — delete from end of preceding line.
      const endPos = new vscode.Position(rangeEnd - 1, lines[rangeEnd - 1].length);
      const adjustedStart =
        rangeStart > 0
          ? new vscode.Position(rangeStart - 1, lines[rangeStart - 1].length)
          : startPos;
      edit.delete(uri, new vscode.Range(adjustedStart, endPos));
    }
  }

  // ---- Week Navigation -------------------------------------------------------

  private async _promptConfigureWeekNav(): Promise<void> {
    const open = await vscode.window.showInformationMessage(
      "Set hexfield-deck.weekFilePattern in settings to enable week navigation.",
      "Open Settings",
    );
    if (open === "Open Settings") {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "hexfield-deck.weekFilePattern",
      );
    }
  }

  private _getWeekNavSettings(): { pattern: string; plannerRoot: string } {
    const config = vscode.workspace.getConfiguration("hexfield-deck");
    return {
      pattern: config.get<string>("weekFilePattern", ""),
      plannerRoot: config.get<string>("plannerRoot", ""),
    };
  }

  private _getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }

  /**
   * Ensures the week file exists (creating it from template if needed).
   * Returns the URI and text content, or null if configuration is missing.
   */
  private async _ensureWeekFile(
    week: number,
    year: number,
  ): Promise<{ uri: vscode.Uri; text: string } | null> {
    const { pattern, plannerRoot } = this._getWeekNavSettings();
    if (!pattern) {
      await this._promptConfigureWeekNav();
      return null;
    }

    const workspaceRoot = this._getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder open.");
      return null;
    }

    const filePath = resolveWeekFilePath(week, year, pattern, plannerRoot, workspaceRoot);
    const uri = vscode.Uri.file(filePath);

    try {
      await vscode.workspace.fs.stat(uri);
      const doc = await vscode.workspace.openTextDocument(uri);
      return { uri, text: doc.getText() };
    } catch {
      // File doesn't exist — create it from template.
      const template = generateWeekTemplate(week, year);
      const dirUri = vscode.Uri.file(path.dirname(filePath));
      await vscode.workspace.fs.createDirectory(dirUri);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(template, "utf-8"));
      return { uri, text: template };
    }
  }

  private async _handleNavigateWeek(delta: number): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const { week, year } = board.frontmatter;

    if (!week || !year) {
      vscode.window.showErrorMessage("Current file has no week/year in frontmatter.");
      return;
    }

    const { pattern } = this._getWeekNavSettings();
    if (!pattern) {
      await this._promptConfigureWeekNav();
      return;
    }

    const { week: targetWeek, year: targetYear } = getAdjacentWeek(week, year, delta);
    const result = await this._ensureWeekFile(targetWeek, targetYear);
    if (!result) return;

    this._document = await vscode.workspace.openTextDocument(result.uri);
    this._update();
  }

  /**
   * Moves a card to the Monday section of the given target week's file.
   * Creates the target file from template if it doesn't exist.
   */
  private async _moveCardToWeekFile(
    cardId: string,
    targetWeek: number,
    targetYear: number,
  ): Promise<void> {
    const result = await this._ensureWeekFile(targetWeek, targetYear);
    if (!result) return;

    const sourceText = this._document.getText();
    const board = parseBoard(sourceText);
    const cards = allCards(board);
    const card = cards.find((c) => c.id === cardId);
    if (!card) {
      vscode.window.showErrorMessage(`Card not found: ${cardId}`);
      return;
    }

    const sourceLines = sourceText.split("\n");
    const cardLineIndex = card.lineNumber - 1;
    const [rangeStart, rangeEnd] = this._getCardLineRange(sourceLines, cardLineIndex);
    const cardLines = sourceLines.slice(rangeStart, rangeEnd);

    const targetLines = result.text.split("\n");
    const insertAt = this._findDaySectionInsertionPoint(targetLines, "Monday");

    const edit = new vscode.WorkspaceEdit();

    // Insert into target file's Monday section (or end of file if no Monday heading).
    if (insertAt !== null) {
      edit.insert(result.uri, new vscode.Position(insertAt, 0), cardLines.join("\n") + "\n");
    } else {
      const lastIdx = targetLines.length - 1;
      edit.insert(
        result.uri,
        new vscode.Position(lastIdx, targetLines[lastIdx].length),
        "\n" + cardLines.join("\n") + "\n",
      );
    }

    // Delete from source file.
    this._addCardDeleteToEdit(edit, this._document.uri, sourceLines, rangeStart, rangeEnd);

    await vscode.workspace.applyEdit(edit);
  }

  private async _handleMoveCardToNextWeek(cardId: string): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const { week, year } = board.frontmatter;

    if (!week || !year) {
      vscode.window.showErrorMessage("Current file has no week/year in frontmatter.");
      return;
    }

    const { pattern } = this._getWeekNavSettings();
    if (!pattern) {
      await this._promptConfigureWeekNav();
      return;
    }

    const { week: nextWeek, year: nextYear } = getAdjacentWeek(week, year, 1);
    await this._moveCardToWeekFile(cardId, nextWeek, nextYear);
  }

  private async _handleMoveCardToWeek(cardId: string): Promise<void> {
    const text = this._document.getText();
    const board = parseBoard(text);
    const { week: currentWeek, year } = board.frontmatter;

    if (!year) {
      vscode.window.showErrorMessage("Current file has no year in frontmatter.");
      return;
    }

    const { pattern } = this._getWeekNavSettings();
    if (!pattern) {
      await this._promptConfigureWeekNav();
      return;
    }

    const MONTHS_SHORT = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const weeksInYear = isoWeeksInYear(year);
    const items = Array.from({ length: weeksInYear }, (_, i) => {
      const w = i + 1;
      const monday = mondayOfISOWeek(w, year);
      const friday = new Date(monday);
      friday.setUTCDate(monday.getUTCDate() + 4);
      return {
        label: `Week ${w}`,
        description: `${MONTHS_SHORT[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${MONTHS_SHORT[friday.getUTCMonth()]} ${friday.getUTCDate()}, ${year}`,
        week: w,
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Select target week (currently Week ${currentWeek ?? "?"})`,
      title: "Move Task to Week",
    });
    if (!selected || selected.week === currentWeek) return;

    await this._moveCardToWeekFile(cardId, selected.week, year);
  }

  private async _handleAddTask(targetDay?: string, targetSection?: string): Promise<void> {
    const title = await vscode.window.showInputBox({
      prompt: "New task title",
      placeHolder: "What needs doing?",
    });
    if (!title) return;

    const text = this._document.getText();
    const lines = text.split("\n");
    const newTaskLine = `- [ ] ${title}`;

    let insertAt: number | null = null;

    if (targetDay) {
      insertAt = this._findDaySectionInsertionPoint(lines, targetDay);
      if (insertAt === null) {
        vscode.window.showErrorMessage(`Day section not found: ${targetDay}`);
        return;
      }
    } else if (targetSection) {
      insertAt = this._findSectionInsertionPoint(lines, targetSection);
      if (insertAt === null) {
        vscode.window.showErrorMessage(`Section not found: ${targetSection}`);
        return;
      }
    } else {
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
