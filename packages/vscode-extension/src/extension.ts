import * as vscode from "vscode";
import { openBoard } from "./commands/openBoard.js";

export function activate(context: vscode.ExtensionContext) {
  const openBoardCommand = vscode.commands.registerCommand(
    "hexfield-deck.openBoard",
    (uri?: vscode.Uri) => openBoard(context, uri),
  );

  context.subscriptions.push(openBoardCommand);
}

export function deactivate() {}
