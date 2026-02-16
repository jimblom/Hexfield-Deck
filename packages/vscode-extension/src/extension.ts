import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const openBoard = vscode.commands.registerCommand(
    "hexfield-deck.openBoard",
    () => {
      vscode.window.showInformationMessage(
        "Hexfield Deck: Board coming soon!",
      );
    },
  );

  context.subscriptions.push(openBoard);
}

export function deactivate() {}
