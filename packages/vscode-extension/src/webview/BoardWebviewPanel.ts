import * as vscode from "vscode";
import {
  parseBoard,
  allCards,
  getCardLineRange,
  findSectionInsertionPoint,
  rebuildTaskLine,
} from "@hexfield-deck/core";
// @ts-expect-error — esbuild bundles CSS as a text string via --loader:.css=text
import stylesContent from "./styles.css";

export class BoardWebviewPanel {
  public static currentPanel: BoardWebviewPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _document: vscode.TextDocument;
  private _disposables: vscode.Disposable[] = [];
  private _statusBarItem: vscode.StatusBarItem | undefined;

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

    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this._statusBarItem.command = "hexfield-deck.openBoard";
    this._updateStatusBar();
    this._statusBarItem.show();
  }

  private _updateStatusBar(): void {
    if (!this._statusBarItem) return;
    const filename = this._document.uri.path.split("/").pop() ?? "Hexfield Deck";
    this._statusBarItem.text = `$(symbol-misc) ${filename}`;
    this._statusBarItem.tooltip = `Hexfield Deck — ${this._document.uri.fsPath}`;
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
        BoardWebviewPanel.currentPanel._updateStatusBar();
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
    const [rangeStart, rangeEnd] = getCardLineRange(lines, cardLineIndex);

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

    const insertAt = findSectionInsertionPoint(lines, sectionHeading, boardHeading);
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
    const newLine = rebuildTaskLine(card, { title: newTitle });

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
    const newLine = rebuildTaskLine(card, { dueDate: newDate || null });

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
    const newLine = rebuildTaskLine(card, { timeEstimate: newEst || null });

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
    const newLine = rebuildTaskLine(card, { priority: newPriority });

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
    const [rangeStart, rangeEnd] = getCardLineRange(lines, cardLineIndex);

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

    const insertAt = findSectionInsertionPoint(lines, sectionHeading, boardHeading);
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

    this._statusBarItem?.dispose();
    this._statusBarItem = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
