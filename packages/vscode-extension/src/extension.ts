import * as vscode from "vscode";
import { openBoard } from "./commands/openBoard.js";

export function activate(context: vscode.ExtensionContext) {
  const openBoardCommand = vscode.commands.registerCommand(
    "hexfield-deck.openBoard",
    () => openBoard(context),
  );

  context.subscriptions.push(openBoardCommand);
}

export function deactivate() {}
