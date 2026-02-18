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
