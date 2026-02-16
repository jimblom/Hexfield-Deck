import * as vscode from "vscode";
import { BoardWebviewPanel } from "../webview/BoardWebviewPanel.js";

export function openBoard(context: vscode.ExtensionContext): void {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage(
      "Hexfield Deck: No active editor. Open a markdown file first.",
    );
    return;
  }

  if (editor.document.languageId !== "markdown") {
    vscode.window.showWarningMessage(
      "Hexfield Deck: Active file is not markdown.",
    );
    return;
  }

  BoardWebviewPanel.createOrShow(context.extensionUri, editor.document);
}
