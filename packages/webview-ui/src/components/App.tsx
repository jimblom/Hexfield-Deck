import React, { useState, useEffect, useMemo, createContext, useCallback } from "react";
import { Board } from "./Board.js";
import { SwimlaneView } from "./SwimlaneView.js";
import { SlateSelector } from "./SlateSelector.js";
import { ContextMenu } from "./ContextMenu.js";
import type { ContextMenuAction } from "./ContextMenu.js";
import { FilterDropdown } from "./FilterDropdown.js";
import type { FilterState, DueDateBucket, EstimateBucket } from "./FilterDropdown.js";
import { EMPTY_FILTER, isFilterActive } from "./FilterDropdown.js";
import { ProjectPanel } from "./ProjectPanel.js";
import { SearchBar } from "./SearchBar.js";
import type { BoardData, Card, Priority, TaskStatus } from "@hexfield-deck/core";
import type { HostBridge, ProjectConfig } from "../HostBridge.js";

// Re-export ProjectConfig so existing imports from "./App.js" keep working
export type { ProjectConfig } from "../HostBridge.js";

type ViewMode = "standard" | "swimlane";
type ColorConfig = Record<string, string>;

// Context for opening the context menu from any card
export type ContextMenuHandler = (card: Card, pos: { x: number; y: number }) => void;
export const ContextMenuContext = createContext<ContextMenuHandler>(() => {});

// Context for jumping to a card's source line in the markdown file
export type JumpToSourceHandler = (cardId: string) => void;
export const JumpToSourceContext = createContext<JumpToSourceHandler>(() => {});

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
  const blockedVisible = f.statuses.includes("blocked" as TaskStatus);
  return cards.filter((card) => {
    if (card.status === "wont-do" && !wontDoVisible) return false;
    if (card.status === "blocked" && !blockedVisible) return false;
    if (!isFilterActive(f)) return true;
    if (f.projects.length > 0 && (!card.project || !f.projects.includes(card.project)))
      return false;
    if (!f.statuses.includes(card.status as TaskStatus))
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

export function App({ bridge }: { bridge: HostBridge }) {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = bridge.getState();
    if (saved && (saved.viewMode === "standard" || saved.viewMode === "swimlane")) {
      return saved.viewMode as ViewMode;
    }
    return "standard";
  });
  const [activeSlateIndex, setActiveSlateIndex] = useState<number>(() => {
    const saved = bridge.getState();
    if (saved && typeof saved.slateIndex === "number") return saved.slateIndex;
    return 0;
  });
  const [contextMenu, setContextMenu] = useState<{ card: Card; x: number; y: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterState>(EMPTY_FILTER);
  const [projects, setProjects] = useState<Record<string, ProjectConfig>>({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const unsubscribe = bridge.onUpdate((payload) => {
      setBoardData(payload.boardData);
      setCards(payload.cards);
      setIsDirty(payload.isDirty ?? false);
      if (payload.colors) applyColorVars(payload.colors);
      if (payload.projects) setProjects(payload.projects);
    });

    // Intercept link clicks from rendered markdown — event delegation avoids
    // per-card handlers and works with dangerouslySetInnerHTML content.
    const linkClickHandler = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;
      event.preventDefault();
      bridge.send({ type: "openLink", url: href });
    };
    document.addEventListener("click", linkClickHandler);

    // Signal to host that the UI is ready to receive data
    bridge.send({ type: "ready" });

    return () => {
      unsubscribe();
      document.removeEventListener("click", linkClickHandler);
    };
  }, [bridge]);

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
    bridge.send({ type: "updateProjectConfig", projects: newConfig });
  }, [bridge]);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    bridge.setState({ ...bridge.getState(), viewMode: mode });
  };

  const handleSlateChange = (index: number) => {
    setActiveSlateIndex(index);
    setSearchQuery("");
    bridge.setState({ ...bridge.getState(), slateIndex: index });
  };

  const handleCardMove = (cardId: string, newStatus: string) => {
    bridge.send({ type: "moveCard", cardId, newStatus });
  };

  const handleCardMoveToSection = (
    cardId: string,
    sectionHeading: string,
    boardHeading: string,
    newStatus?: string,
  ) => {
    bridge.send({ type: "moveCardToSection", cardId, sectionHeading, boardHeading, newStatus });
  };

  const handleToggleSubTask = (lineNumber: number) => {
    bridge.send({ type: "toggleSubTask", lineNumber });
  };

  const openContextMenu: ContextMenuHandler = useCallback((card, pos) => {
    setContextMenu({ card, x: pos.x, y: pos.y });
  }, []);

  const handleJumpToSource: JumpToSourceHandler = useCallback((cardId: string) => {
    bridge.send({ type: "openInMarkdown", cardId });
  }, [bridge]);

  const handleContextMenuAction = (action: ContextMenuAction) => {
    if (!contextMenu) return;
    const { card } = contextMenu;

    switch (action.type) {
      case "openInMarkdown":
        bridge.send({ type: "openInMarkdown", cardId: card.id });
        break;
      case "editTitle":
        bridge.send({ type: "editTitle", cardId: card.id });
        break;
      case "editDueDate":
        bridge.send({ type: "editDueDate", cardId: card.id });
        break;
      case "editTimeEstimate":
        bridge.send({ type: "editTimeEstimate", cardId: card.id });
        break;
      case "setPriority":
        bridge.send({ type: "setPriority", cardId: card.id, priority: action.priority });
        break;
      case "changeState":
        handleCardMove(card.id, action.newStatus);
        break;
      case "moveToSection":
        handleCardMoveToSection(card.id, action.sectionHeading, action.boardHeading);
        break;
      case "deleteTask":
        bridge.send({ type: "deleteTask", cardId: card.id });
        break;
    }
  };

  const handleQuickAdd = () => {
    if (!boardData) return;
    const activeBoard = boardData.boards[activeSlateIndex] ?? boardData.boards[0];
    if (!activeBoard) return;
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const dayRows = activeBoard.rows.filter((r) => r.dayName);
    const todayRow = dayRows.find((r) => r.dayName?.toLowerCase() === todayName.toLowerCase());
    const targetRow = todayRow ?? dayRows[0] ?? activeBoard.rows[0];
    if (targetRow) {
      bridge.send({
        type: "addTask",
        sectionHeading: targetRow.heading,
        boardHeading: activeBoard.heading,
      });
    }
  };

  if (!boardData || !filteredBoardData) {
    return (
      <div className="loading">
        <p>Loading board...</p>
      </div>
    );
  }

  const safeSlateIndex = Math.min(activeSlateIndex, filteredBoardData.boards.length - 1);
  const activeSlate = filteredBoardData.boards[safeSlateIndex] ?? filteredBoardData.boards[0];

  const matchesSearch = (c: { title: string }) =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase());

  const searchFilteredSlate = activeSlate
    ? {
        ...activeSlate,
        rows: activeSlate.rows.map((row) => ({
          ...row,
          cards: row.cards.filter(matchesSearch),
        })),
      }
    : activeSlate;

  const slateCards = searchFilteredSlate?.rows.flatMap((r) => r.cards) ?? [];

  const unfilteredSlate = boardData.boards[safeSlateIndex] ?? boardData.boards[0];
  const progressCards = unfilteredSlate?.rows.flatMap((r) => r.cards) ?? [];
  const progressTotal = progressCards.filter(
    (c) => c.status !== "wont-do" && c.status !== "blocked"
  ).length;
  const progressDone = progressCards.filter((c) => c.status === "done").length;

  const allSlateCards = unfilteredSlate?.rows.flatMap((r) => r.cards) ?? [];
  const genuinelyEmpty = allSlateCards.length === 0;
  const noCardsAfterFilter = !genuinelyEmpty && slateCards.length === 0;

  const renderView = () => {
    if (!searchFilteredSlate) return null;
    if (genuinelyEmpty) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">This slate has no tasks</div>
          <div className="empty-state-body">
            Add a task with the <strong>+</strong> button, or open the markdown file to write tasks directly.
          </div>
        </div>
      );
    }
    if (noCardsAfterFilter) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No cards match the current filters</div>
          <div className="empty-state-body">
            Try adjusting your filters, or{" "}
            <button className="empty-state-link" onClick={() => setActiveFilter(EMPTY_FILTER)}>
              clear all filters
            </button>{" "}
            to see everything.
          </div>
        </div>
      );
    }
    switch (viewMode) {
      case "standard":
        return (
          <Board
            cards={slateCards}
            onCardMove={handleCardMove}
            onToggleSubTask={handleToggleSubTask}
          />
        );
      case "swimlane":
        return (
          <SwimlaneView
            board={searchFilteredSlate}
            onCardMove={handleCardMove}
            onCardMoveToSection={(cardId, sectionHeading, boardHeading, newStatus) =>
              handleCardMoveToSection(cardId, sectionHeading, boardHeading, newStatus)
            }
            onToggleSubTask={handleToggleSubTask}
          />
        );
    }
  };

  return (
    <ProjectContext.Provider value={projects}>
    <JumpToSourceContext.Provider value={handleJumpToSource}>
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
              <SlateSelector
                boards={boardData.boards}
                activeIndex={safeSlateIndex}
                onChange={handleSlateChange}
              />
              {progressTotal > 0 && (
                <span className="slate-progress">{progressDone} / {progressTotal} done</span>
              )}
            </div>
            <div className="toolbar-right">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
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
                  title="Swimlane view — rows × status grid"
                >
                  Swimlane
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
    </JumpToSourceContext.Provider>
    </ProjectContext.Provider>
  );
}
