import * as vscode from "vscode";
import { BoardWebviewPanel } from "../webview/BoardWebviewPanel.js";

export async function openBoard(
  context: vscode.ExtensionContext,
  uri?: vscode.Uri,
): Promise<void> {
  let document: vscode.TextDocument;

  if (uri) {
    // Called from context menu with a file URI
    try {
      document = await vscode.workspace.openTextDocument(uri);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Hexfield Deck: Failed to open file: ${error}`,
      );
      return;
    }
  } else {
    // Called from command palette - use active editor
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showWarningMessage(
        "Hexfield Deck: No active editor. Open a markdown file first.",
      );
      return;
    }

    document = editor.document;
  }

  if (document.languageId !== "markdown" && document.languageId !== "hexfield-markdown") {
    vscode.window.showWarningMessage(
      "Hexfield Deck: Selected file is not markdown.",
    );
    return;
  }

  BoardWebviewPanel.createOrShow(context.extensionUri, document);
}
