import React, { useState, useEffect } from "react";
import { Board } from "./Board.js";
import type { BoardData, Card } from "@hexfield-deck/core";

// VS Code API type
declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

export function App() {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  useEffect(() => {
    // Listen for messages from extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case "update":
          setBoardData(message.boardData);
          setCards(message.cards);
          setIsDirty(message.isDirty ?? false);
          break;
      }
    };

    window.addEventListener("message", messageHandler);

    // Signal to extension that webview is ready
    vscode.postMessage({ type: "ready" });

    return () => window.removeEventListener("message", messageHandler);
  }, []);

  const handleCardMove = (cardId: string, newStatus: string) => {
    // Send message to extension to update markdown
    vscode.postMessage({
      type: "moveCard",
      cardId,
      newStatus,
    });
  };

  if (!boardData) {
    return (
      <div className="loading">
        <p>Loading board...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-main">
          <h1>Hexfield Deck</h1>
          {isDirty && (
            <span className="unsaved-indicator" title="File has unsaved changes">
              ● Unsaved changes
            </span>
          )}
        </div>
        <div className="subtitle">
          Week {boardData.frontmatter.week}, {boardData.frontmatter.year}
        </div>
      </div>
      <Board cards={cards} onCardMove={handleCardMove} />
    </div>
  );
}
