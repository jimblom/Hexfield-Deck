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
import type { BoardData, Card, TaskStatus } from "@hexfield-deck/core";

interface SwimlaneViewProps {
  boardData: BoardData;
  onCardMove: (cardId: string, newStatus: string) => void;
  onCardMoveToDay: (cardId: string, targetDay: string, newStatus: string) => void;
  onToggleSubTask: (lineNumber: number) => void;
}

interface SwimlaneRow {
  key: string;
  label: string;
  dayName: string;
  cards: Card[];
  isBacklog?: boolean;
}

const STATUS_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
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

function buildRows(boardData: BoardData): SwimlaneRow[] {
  const rows: SwimlaneRow[] = [];

  for (const day of boardData.days) {
    rows.push({
      key: day.dayName,
      label: day.heading,
      dayName: day.dayName,
      cards: day.cards,
    });
  }

  // Combine all backlog cards into one row
  const backlogCards: Card[] = [
    ...boardData.backlog.flatMap((b) => b.cards),
    ...boardData.thisQuarter,
    ...boardData.thisYear,
    ...boardData.parkingLot,
  ];
  if (backlogCards.length > 0) {
    rows.push({
      key: "backlog",
      label: "Backlog",
      dayName: "Backlog",
      cards: backlogCards,
      isBacklog: true,
    });
  }

  return rows;
}

/** Parse a composite droppable ID like "Monday:todo" */
function parseDropId(id: string): { day: string; status: TaskStatus } | null {
  const parts = id.split(":");
  if (parts.length !== 2) return null;
  const [day, status] = parts;
  if (status === "todo" || status === "in-progress" || status === "done") {
    return { day, status };
  }
  return null;
}

export function SwimlaneView({
  boardData,
  onCardMove,
  onCardMoveToDay,
  onToggleSubTask,
}: SwimlaneViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const rows = buildRows(boardData);
  const allCards = rows.flatMap((r) => r.cards);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    // Backlog collapsed by default
    const initial: Record<string, boolean> = {};
    for (const row of rows) {
      if (row.isBacklog) initial[row.key] = true;
    }
    return initial;
  });

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /** Check if a card belongs to the backlog (no day property). */
  const isBacklogCard = (c: Card) => !c.day;

  /** Get the effective row key for a card. */
  const getCardRow = (c: Card) => c.day || "Backlog";

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const card = allCards.find((c) => c.id === cardId);
    if (!card) return;

    const overId = over.id as string;

    // Try parsing as a composite drop zone ID (day:status)
    const dropTarget = parseDropId(overId);
    if (dropTarget) {
      const sourceRow = getCardRow(card);
      const targetRow = dropTarget.day;
      const sameRow = sourceRow === targetRow;

      if (sameRow && card.status === dropTarget.status) return;

      if (sameRow || isBacklogCard(card) || targetRow === "Backlog") {
        // Same row, or involves backlog — just change status
        onCardMove(cardId, dropTarget.status);
      } else {
        // Cross-day move (between actual day sections)
        onCardMoveToDay(cardId, dropTarget.day, dropTarget.status);
      }
      return;
    }

    // Dropped on a card — find that card's day and status
    const targetCard = allCards.find((c) => c.id === overId);
    if (!targetCard) return;

    const sourceRow = getCardRow(card);
    const targetRow = getCardRow(targetCard);
    const sameRow = sourceRow === targetRow;

    if (sameRow && card.status === targetCard.status) return;

    if (sameRow || isBacklogCard(card) || isBacklogCard(targetCard)) {
      // Same row, or involves backlog — just change status
      onCardMove(cardId, targetCard.status);
    } else {
      // Cross-day move
      onCardMoveToDay(cardId, targetRow, targetCard.status);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="swimlane-view">
        {/* Column headers */}
        <div className="swimlane-header">
          <div className="swimlane-label-cell" />
          {STATUS_COLUMNS.map((col) => (
            <div key={col.id} className="swimlane-col-header">{col.label}</div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row) => {
          const isCollapsed = collapsed[row.key] ?? false;
          const todoCards = row.cards.filter((c) => c.status === "todo");
          const inProgressCards = row.cards.filter((c) => c.status === "in-progress");
          const doneCards = row.cards.filter((c) => c.status === "done");
          const totalCards = row.cards.length;

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
                <span className="swimlane-label">{row.dayName}</span>
                <span className="swimlane-count">{totalCards}</span>
              </div>
              {!isCollapsed && (
                <>
                  <MiniColumn
                    droppableId={`${row.dayName}:todo`}
                    cards={todoCards}
                    onToggleSubTask={onToggleSubTask}
                  />
                  <MiniColumn
                    droppableId={`${row.dayName}:in-progress`}
                    cards={inProgressCards}
                    onToggleSubTask={onToggleSubTask}
                  />
                  <MiniColumn
                    droppableId={`${row.dayName}:done`}
                    cards={doneCards}
                    onToggleSubTask={onToggleSubTask}
                  />
                </>
              )}
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
  );
}
