import React, { useState, useEffect, createContext, useCallback } from "react";
import { Board } from "./Board.js";
import { BacklogView } from "./BacklogView.js";
import { SwimlaneView } from "./SwimlaneView.js";
import { ContextMenu } from "./ContextMenu.js";
import type { ContextMenuAction } from "./ContextMenu.js";
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

// Context for opening the context menu from any card
export type ContextMenuHandler = (card: Card, pos: { x: number; y: number }) => void;
export const ContextMenuContext = createContext<ContextMenuHandler>(() => {});

export function App() {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [contextMenu, setContextMenu] = useState<{ card: Card; x: number; y: number } | null>(null);

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

    // Intercept link clicks from rendered markdown — event delegation avoids
    // per-card handlers and works with dangerouslySetInnerHTML content.
    const linkClickHandler = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;
      event.preventDefault();
      vscode.postMessage({ type: "openLink", url: href });
    };
    document.addEventListener("click", linkClickHandler);

    // Signal to extension that webview is ready
    vscode.postMessage({ type: "ready" });

    return () => {
      window.removeEventListener("message", messageHandler);
      document.removeEventListener("click", linkClickHandler);
    };
  }, []);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    vscode.setState({ ...vscode.getState(), viewMode: mode });
  };

  const handleCardMove = (cardId: string, newStatus: string) => {
    vscode.postMessage({ type: "moveCard", cardId, newStatus });
  };

  const handleCardMoveToDay = (cardId: string, targetDay: string, newStatus: string) => {
    vscode.postMessage({ type: "moveCardToDay", cardId, targetDay, newStatus });
  };

  const handleCardMoveToSection = (cardId: string, targetSection: string) => {
    vscode.postMessage({ type: "moveCardToSection", cardId, targetSection });
  };

  const handleToggleSubTask = (lineNumber: number) => {
    vscode.postMessage({ type: "toggleSubTask", lineNumber });
  };

  const openContextMenu: ContextMenuHandler = useCallback((card, pos) => {
    setContextMenu({ card, x: pos.x, y: pos.y });
  }, []);

  const handleContextMenuAction = (action: ContextMenuAction) => {
    if (!contextMenu) return;
    const { card } = contextMenu;

    switch (action.type) {
      case "openInMarkdown":
        vscode.postMessage({ type: "openInMarkdown", cardId: card.id });
        break;
      case "editTitle":
        vscode.postMessage({ type: "editTitle", cardId: card.id });
        break;
      case "editDueDate":
        vscode.postMessage({ type: "editDueDate", cardId: card.id });
        break;
      case "editTimeEstimate":
        vscode.postMessage({ type: "editTimeEstimate", cardId: card.id });
        break;
      case "setPriority":
        vscode.postMessage({ type: "setPriority", cardId: card.id, priority: action.priority });
        break;
      case "changeState":
        handleCardMove(card.id, action.newStatus);
        break;
      case "moveToDay":
        handleCardMoveToDay(card.id, action.targetDay, action.newStatus);
        break;
      case "moveToBacklog":
        handleCardMoveToSection(card.id, action.targetSection);
        break;
      case "deleteTask":
        vscode.postMessage({ type: "deleteTask", cardId: card.id });
        break;
    }
  };

  const handleQuickAdd = () => {
    if (!boardData) return;

    if (viewMode === "backlog") {
      vscode.postMessage({ type: "addTask", targetSection: "now" });
    } else {
      // Find today's day name
      const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const todaySection = boardData.days.find(
        (d) => d.dayName.toLowerCase() === todayName.toLowerCase()
      );
      const targetDay = todaySection?.dayName ?? boardData.days[0]?.dayName;
      if (targetDay) {
        vscode.postMessage({ type: "addTask", targetDay });
      }
    }
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
        return <BacklogView boardData={boardData} onCardMove={handleCardMove} onCardMoveToSection={handleCardMoveToSection} />;
    }
  };

  return (
    <ContextMenuContext.Provider value={openContextMenu}>
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
            <div className="toolbar-right">
              <button
                className="quick-add-btn"
                onClick={handleQuickAdd}
                title="Add task"
              >
                +
              </button>
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
        </div>
        {renderView()}
        {contextMenu && boardData && (
          <ContextMenu
            card={contextMenu.card}
            x={contextMenu.x}
            y={contextMenu.y}
            boardData={boardData}
            onAction={handleContextMenuAction}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </ContextMenuContext.Provider>
  );
}
