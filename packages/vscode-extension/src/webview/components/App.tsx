import React, { useState, useEffect } from "react";
import { Board } from "./Board.js";
import { BacklogView } from "./BacklogView.js";
import { SwimlaneView } from "./SwimlaneView.js";
import type { BoardData, Card } from "@hexfield-deck/core";

type ViewMode = "standard" | "swimlane" | "backlog";

// VS Code API type
declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
  getState(): Record<string, unknown> | null;
  setState(state: Record<string, unknown>): void;
};

const vscode = acquireVsCodeApi();

function getInitialViewMode(): ViewMode {
  const saved = vscode.getState();
  if (saved && typeof saved.viewMode === "string") {
    return saved.viewMode as ViewMode;
  }
  return "standard";
}

export function App() {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);

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

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    vscode.setState({ ...vscode.getState(), viewMode: mode });
  };

  const handleCardMove = (cardId: string, newStatus: string) => {
    vscode.postMessage({
      type: "moveCard",
      cardId,
      newStatus,
    });
  };

  const handleCardMoveToDay = (cardId: string, targetDay: string, newStatus: string) => {
    vscode.postMessage({
      type: "moveCardToDay",
      cardId,
      targetDay,
      newStatus,
    });
  };

  const handleToggleSubTask = (lineNumber: number) => {
    vscode.postMessage({
      type: "toggleSubTask",
      lineNumber,
    });
  };

  if (!boardData) {
    return (
      <div className="loading">
        <p>Loading board...</p>
      </div>
    );
  }

  const renderView = () => {
    switch (viewMode) {
      case "standard":
        return <Board cards={cards} onCardMove={handleCardMove} onToggleSubTask={handleToggleSubTask} />;
      case "swimlane":
        return (
          <SwimlaneView
            boardData={boardData}
            onCardMove={handleCardMove}
            onCardMoveToDay={handleCardMoveToDay}
            onToggleSubTask={handleToggleSubTask}
          />
        );
      case "backlog":
        return <BacklogView boardData={boardData} onCardMove={handleCardMove} />;
    }
  };

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
        <div className="header-row">
          <div className="subtitle">
            Week {boardData.frontmatter.week}, {boardData.frontmatter.year}
          </div>
          <div className="view-switcher">
            <button
              className={`view-btn ${viewMode === "standard" ? "active" : ""}`}
              onClick={() => handleViewChange("standard")}
              title="Standard view — 3-column kanban"
            >
              Standard
            </button>
            <button
              className={`view-btn ${viewMode === "swimlane" ? "active" : ""}`}
              onClick={() => handleViewChange("swimlane")}
              title="Swimlane view — grouped by day"
            >
              Swimlane
            </button>
            <button
              className={`view-btn ${viewMode === "backlog" ? "active" : ""}`}
              onClick={() => handleViewChange("backlog")}
              title="Backlog view — priority buckets"
            >
              Backlog
            </button>
          </div>
        </div>
      </div>
      {renderView()}
    </div>
  );
}
