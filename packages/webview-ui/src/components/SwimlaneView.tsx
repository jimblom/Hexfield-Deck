import React, { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CardComponent } from "./Card.js";
import { SortBar, sortCards } from "./SortBar.js";
import type { SortKey } from "./SortBar.js";
import { displayLabel } from "@hexfield-deck/core";
import type { Board, Card, TaskStatus } from "@hexfield-deck/core";

interface SwimlaneViewProps {
  board: Board;
  onCardMove: (cardId: string, newStatus: string) => void;
  onCardMoveToSection: (
    cardId: string,
    sectionHeading: string,
    boardHeading: string,
    newStatus: string,
  ) => void;
  onToggleSubTask: (lineNumber: number) => void;
}

interface SwimlaneRow {
  /** Numeric index as string — used as the stable droppable ID prefix. */
  key: string;
  label: string;
  sectionHeading: string;
  boardHeading: string;
  dayName?: string;
  date?: string;
  cards: Card[];
}

const BASE_STATUS_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

const EXTRA_STATUS_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "blocked", label: "Blocked" },
  { id: "wont-do", label: "Won't Do" },
];

/** Droppable mini-column inside a swimlane row */
function MiniColumn({
  droppableId,
  cards,
  onToggleSubTask,
}: {
  droppableId: string;
  cards: Card[];
  onToggleSubTask: (lineNumber: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div
      className={`swimlane-cell ${isOver ? "swimlane-cell-over" : ""}`}
      ref={setNodeRef}
    >
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        {cards.map((card) => (
          <CardComponent key={card.id} card={card} onToggleSubTask={onToggleSubTask} />
        ))}
      </SortableContext>
    </div>
  );
}

/** Every H2 row in the active slate becomes a swimlane row. */
function buildRows(board: Board): SwimlaneRow[] {
  return board.rows.map((row, i) => ({
    key: String(i),
    label: row.heading,
    sectionHeading: row.heading,
    boardHeading: board.heading,
    dayName: row.dayName,
    date: row.date,
    cards: row.cards,
  }));
}

const ALL_STATUSES = new Set<string>(["todo", "in-progress", "done", "blocked", "wont-do"]);

/** Parse a droppable ID like "3:in-progress" — splits on last colon. */
function parseDropId(
  id: string,
  rows: SwimlaneRow[],
): { row: SwimlaneRow; status: TaskStatus } | null {
  const lastColon = id.lastIndexOf(":");
  if (lastColon === -1) return null;
  const rowKey = id.substring(0, lastColon);
  const status = id.substring(lastColon + 1);
  if (!ALL_STATUSES.has(status)) return null;
  const row = rows.find((r) => r.key === rowKey);
  if (!row) return null;
  return { row, status: status as TaskStatus };
}

export function SwimlaneView({
  board,
  onCardMove,
  onCardMoveToSection,
  onToggleSubTask,
}: SwimlaneViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("default");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const rows = buildRows(board);
  const allCards = rows.flatMap((r) => r.cards);

  // Include Blocked / Won't Do columns only when cards with those statuses are present
  const extraStatuses = EXTRA_STATUS_COLUMNS.filter((col) =>
    allCards.some((c) => c.status === col.id)
  );
  const statusColumns = [...BASE_STATUS_COLUMNS, ...extraStatuses];

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    // Expand today's day row; collapse all others
    const todayISO = new Date().toISOString().slice(0, 10);
    const initial: Record<string, boolean> = {};
    for (const row of rows) {
      if (row.sectionHeading === "") continue; // implicit row stays expanded
      if (!row.dayName || (row.date && row.date !== todayISO)) {
        initial[row.key] = true;
      }
    }
    return initial;
  });

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /** Find the swimlane row a card belongs to. */
  const getCardRowKey = (c: Card) => {
    const row = rows.find(
      (r) => r.sectionHeading === c.sectionHeading && r.boardHeading === c.boardHeading
    );
    return row?.key ?? "";
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const card = allCards.find((c) => c.id === cardId);
    if (!card) return;

    const overId = over.id as string;

    // Try parsing as a composite drop zone ID (rowKey:status)
    const dropTarget = parseDropId(overId, rows);
    if (dropTarget) {
      const sourceRowKey = getCardRowKey(card);
      const targetRowKey = dropTarget.row.key;
      const sameRow = sourceRowKey === targetRowKey;

      if (sameRow && card.status === dropTarget.status) return;

      if (sameRow) {
        onCardMove(cardId, dropTarget.status);
      } else {
        onCardMoveToSection(
          cardId,
          dropTarget.row.sectionHeading,
          dropTarget.row.boardHeading,
          dropTarget.status,
        );
      }
      return;
    }

    // Dropped on a card — find that card's row and status
    const targetCard = allCards.find((c) => c.id === overId);
    if (!targetCard) return;

    const sourceRowKey = getCardRowKey(card);
    const targetRowKey = getCardRowKey(targetCard);
    const sameRow = sourceRowKey === targetRowKey;

    if (sameRow && card.status === targetCard.status) return;

    if (sameRow) {
      onCardMove(cardId, targetCard.status);
    } else {
      const targetRow = rows.find((r) => r.key === targetRowKey);
      if (targetRow) {
        onCardMoveToSection(
          cardId,
          targetRow.sectionHeading,
          targetRow.boardHeading,
          targetCard.status,
        );
      }
    }
  };

  return (
    <>
    <SortBar sortKey={sortKey} onSortChange={setSortKey} />
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="swimlane-view" style={{ gridTemplateColumns: `140px repeat(${statusColumns.length}, 1fr)` }}>
        {/* Column headers */}
        <div className="swimlane-header">
          <div className="swimlane-label-cell" />
          {statusColumns.map((col) => (
            <div key={col.id} className="swimlane-col-header">{col.label}</div>
          ))}
        </div>

        {/* Rows — every H2 in the active Slate */}
        {rows.map((row) => {
          const isCollapsed = collapsed[row.key] ?? false;
          const cardsByStatus = (status: TaskStatus) =>
            sortCards(row.cards.filter((c) => c.status === status), sortKey);
          const totalCards = row.cards.length;

          const todoCards = cardsByStatus("todo");
          const inProgressCards = cardsByStatus("in-progress");
          const doneCards = cardsByStatus("done");

          return (
            <div key={row.key} className="swimlane-row">
              <div className="swimlane-label-cell">
                <button
                  className="swimlane-collapse-btn"
                  onClick={() => toggleCollapse(row.key)}
                  title={isCollapsed ? "Expand" : "Collapse"}
                >
                  {isCollapsed ? "▶" : "▼"}
                </button>
                <span className="swimlane-label">{row.label ? displayLabel(row.label) : "General"}</span>
                <span className="swimlane-count">{totalCards}</span>
              </div>
              {!isCollapsed && statusColumns.map((col) => (
                <MiniColumn
                  key={col.id}
                  droppableId={`${row.key}:${col.id}`}
                  cards={cardsByStatus(col.id)}
                  onToggleSubTask={onToggleSubTask}
                />
              ))}
              {isCollapsed && (
                <div className="swimlane-collapsed-summary">
                  {todoCards.length} to do, {inProgressCards.length} in progress, {doneCards.length} done
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DndContext>
    </>
  );
}
