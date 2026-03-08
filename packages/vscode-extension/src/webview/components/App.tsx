import React, { useState, useEffect, useMemo, createContext, useCallback } from "react";
import { Board } from "./Board.js";
import { BacklogView } from "./BacklogView.js";
import { SwimlaneView } from "./SwimlaneView.js";
import { ContextMenu } from "./ContextMenu.js";
import type { ContextMenuAction } from "./ContextMenu.js";
import { FilterDropdown } from "./FilterDropdown.js";
import type { FilterState, DueDateBucket, EstimateBucket } from "./FilterDropdown.js";
import { EMPTY_FILTER, isFilterActive } from "./FilterDropdown.js";
import { ProjectPanel } from "./ProjectPanel.js";
import type { BoardData, Card, Priority, TaskStatus } from "@hexfield-deck/core";

type ViewMode = "standard" | "swimlane" | "backlog";

export interface ProjectConfig {
  color?: string;
  url?: string;
  style?: "border" | "fill" | "both";
}

type ColorConfig = Record<string, string>;

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

// Context for per-project config (color, url)
export const ProjectContext = createContext<Record<string, ProjectConfig>>({});

function applyColorVars(colors: ColorConfig): void {
  const root = document.documentElement;
  root.style.setProperty("--hx-project-tag", colors.projectTag);
  root.style.setProperty("--hx-priority-high", colors.priorityHigh);
  root.style.setProperty("--hx-priority-med", colors.priorityMed);
  root.style.setProperty("--hx-priority-low", colors.priorityLow);
  root.style.setProperty("--hx-time-estimate", colors.timeEstimate);
  root.style.setProperty("--hx-due-overdue", colors.dueDateOverdue);
  root.style.setProperty("--hx-due-today", colors.dueDateToday);
  root.style.setProperty("--hx-due-soon", colors.dueDateSoon);
  root.style.setProperty("--hx-due-future", colors.dueDateFuture);
}

// ---- Filter helpers --------------------------------------------------------

function matchesDueDateBucket(dueDate: string | undefined, buckets: DueDateBucket[]): boolean {
  if (buckets.includes("none") && !dueDate) return true;
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86_400_000);
  if (buckets.includes("overdue") && diff < 0) return true;
  if (buckets.includes("today") && diff === 0) return true;
  if (buckets.includes("this-week") && diff >= 0 && diff <= 7) return true;
  return false;
}

function parseEstimateMinutes(est?: string): number | null {
  if (!est) return null;
  let total = 0;
  const hours = est.match(/(\d+)h/);
  const mins = est.match(/(\d+)m/);
  if (hours) total += parseInt(hours[1]) * 60;
  if (mins) total += parseInt(mins[1]);
  return total || null;
}

function matchesEstimateBucket(timeEstimate: string | undefined, buckets: EstimateBucket[]): boolean {
  if (buckets.includes("none") && !timeEstimate) return true;
  if (!timeEstimate) return false;
  const mins = parseEstimateMinutes(timeEstimate);
  if (mins === null) return false;
  if (buckets.includes("short") && mins <= 30) return true;
  if (buckets.includes("medium") && mins > 30 && mins <= 120) return true;
  if (buckets.includes("long") && mins > 120) return true;
  return false;
}

function filterCards(cards: Card[], f: FilterState): Card[] {
  const wontDoVisible = f.statuses.includes("wont-do" as TaskStatus);
  return cards.filter((card) => {
    // wont-do is hidden by default; only visible when explicitly filtered in
    if (card.status === "wont-do" && !wontDoVisible) return false;
    if (!isFilterActive(f)) return true;
    if (f.projects.length > 0 && (!card.project || !f.projects.includes(card.project)))
      return false;
    if (f.statuses.length > 0 && !f.statuses.includes(card.status as TaskStatus))
      return false;
    if (f.priorities.length > 0 && (!card.priority || !f.priorities.includes(card.priority as Priority)))
      return false;
    if (f.dueDates.length > 0 && !matchesDueDateBucket(card.dueDate, f.dueDates))
      return false;
    if (f.estimates.length > 0 && !matchesEstimateBucket(card.timeEstimate, f.estimates))
      return false;
    return true;
  });
}

function filterBoardData(boardData: BoardData, f: FilterState): BoardData {
  const keep = (cards: Card[]) => filterCards(cards, f);
  return {
    ...boardData,
    boards: boardData.boards.map((board) => ({
      ...board,
      rows: board.rows.map((row) => ({ ...row, cards: keep(row.cards) })),
    })),
  };
}

// ---------------------------------------------------------------------------

export function App() {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [contextMenu, setContextMenu] = useState<{ card: Card; x: number; y: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterState>(EMPTY_FILTER);
  const [projects, setProjects] = useState<Record<string, ProjectConfig>>({});

  useEffect(() => {
    // Listen for messages from extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case "update":
          setBoardData(message.boardData);
          setCards(message.cards);
          setIsDirty(message.isDirty ?? false);
          if (message.colors) applyColorVars(message.colors);
          if (message.projects) setProjects(message.projects);
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

  // Filtered data — recomputed whenever cards, boardData, or the active filter changes.
  // `cards` (unfiltered) is still passed to FilterDropdown so it can enumerate all projects.
  const filteredCards = useMemo(() => filterCards(cards, activeFilter), [cards, activeFilter]);
  const filteredBoardData = useMemo(
    () => (boardData ? filterBoardData(boardData, activeFilter) : null),
    [boardData, activeFilter]
  );

  const discoveredProjects = useMemo(
    () => [...new Set(cards.map((c) => c.project).filter((p): p is string => !!p))].sort(),
    [cards]
  );

  const handleProjectConfigChange = useCallback((newConfig: Record<string, ProjectConfig>) => {
    setProjects(newConfig);
    vscode.postMessage({ type: "updateProjectConfig", projects: newConfig });
  }, []);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    vscode.setState({ ...vscode.getState(), viewMode: mode });
  };

  const handleCardMove = (cardId: string, newStatus: string) => {
    vscode.postMessage({ type: "moveCard", cardId, newStatus });
  };

  const handleCardMoveToSection = (
    cardId: string,
    sectionHeading: string,
    boardHeading: string,
    newStatus?: string,
  ) => {
    vscode.postMessage({ type: "moveCardToSection", cardId, sectionHeading, boardHeading, newStatus });
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
      case "moveToSection":
        handleCardMoveToSection(card.id, action.sectionHeading, action.boardHeading);
        break;
      case "deleteTask":
        vscode.postMessage({ type: "deleteTask", cardId: card.id });
        break;
    }
  };

  const handleQuickAdd = () => {
    if (!boardData) return;

    if (viewMode === "backlog") {
      // Target first non-day row of the first board that has one
      const firstBoard = boardData.boards.find((b) => b.rows.some((r) => !r.dayName));
      const firstRow = firstBoard?.rows.find((r) => !r.dayName);
      if (firstBoard && firstRow) {
        vscode.postMessage({
          type: "addTask",
          sectionHeading: firstRow.heading,
          boardHeading: firstBoard.heading,
        });
      }
    } else {
      const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const allDayRows = boardData.boards.flatMap((b) =>
        b.rows.filter((r) => r.dayName).map((r) => ({ ...r, boardHeading: b.heading }))
      );
      const todayRow = allDayRows.find(
        (r) => r.dayName?.toLowerCase() === todayName.toLowerCase()
      );
      const targetRow = todayRow ?? allDayRows[0];
      if (targetRow) {
        vscode.postMessage({
          type: "addTask",
          sectionHeading: targetRow.heading,
          boardHeading: targetRow.boardHeading,
        });
      }
    }
  };

  if (!boardData || !filteredBoardData) {
    return (
      <div className="loading">
        <p>Loading board...</p>
      </div>
    );
  }

  const renderView = () => {
    switch (viewMode) {
      case "standard":
        return (
          <Board
            cards={filteredCards}
            onCardMove={handleCardMove}
            onToggleSubTask={handleToggleSubTask}
          />
        );
      case "swimlane":
        return (
          <SwimlaneView
            boardData={filteredBoardData}
            onCardMove={handleCardMove}
            onCardMoveToSection={(cardId, sectionHeading, boardHeading, newStatus) =>
              handleCardMoveToSection(cardId, sectionHeading, boardHeading, newStatus)
            }
            onToggleSubTask={handleToggleSubTask}
          />
        );
      case "backlog":
        return (
          <BacklogView
            boardData={filteredBoardData}
            onCardMove={handleCardMove}
            onCardMoveToSection={(cardId, sectionHeading, boardHeading) =>
              handleCardMoveToSection(cardId, sectionHeading, boardHeading)
            }
          />
        );
    }
  };

  return (
    <ProjectContext.Provider value={projects}>
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
              <ProjectPanel
                projects={discoveredProjects}
                config={projects}
                onChange={handleProjectConfigChange}
              />
              <FilterDropdown
                cards={cards}
                filter={activeFilter}
                onChange={setActiveFilter}
              />
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
                  title="Swimlane view — grouped by row"
                >
                  Swimlane
                </button>
                <button
                  className={`view-btn ${viewMode === "backlog" ? "active" : ""}`}
                  onClick={() => handleViewChange("backlog")}
                  title="Backlog view — non-day rows"
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
    </ProjectContext.Provider>
  );
}
