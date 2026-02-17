import * as vscode from "vscode";
import { parseBoard, allCards } from "@hexfield-deck/core";
import * as fs from "fs";

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

    // Initial data send
    this._update();

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
          case "moveCard":
            this._handleMoveCard(message.cardId, message.newStatus);
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

    const stylesPath = vscode.Uri.joinPath(
      this._extensionUri,
      "src",
      "webview",
      "styles.css",
    );
    const stylesContent = fs.readFileSync(stylesPath.fsPath, "utf8");

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
