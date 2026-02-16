import * as vscode from "vscode";
import { parseBoard, allCards } from "@hexfield-deck/core";
import { getWebviewHtml } from "./htmlGenerator.js";

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

    // Initial render
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
        enableScripts: false,
        retainContextWhenHidden: true,
      },
    );

    BoardWebviewPanel.currentPanel = new BoardWebviewPanel(
      panel,
      extensionUri,
      document,
    );
  }

  private _update(): void {
    const text = this._document.getText();
    const board = parseBoard(text);
    const cards = allCards(board);

    this._panel.webview.html = getWebviewHtml(board, cards);
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
