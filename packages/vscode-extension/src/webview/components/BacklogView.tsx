import React, { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortBar, sortCards } from "./SortBar.js";
import type { SortKey } from "./SortBar.js";
import type { BoardData, Card } from "@hexfield-deck/core";

interface BacklogViewProps {
  boardData: BoardData;
  onCardMove: (cardId: string, newStatus: string) => void;
  onCardMoveToSection: (cardId: string, targetSection: string) => void;
}

interface Bucket {
  id: string;
  title: string;
  sectionKey: string;
  cards: Card[];
}

function getBuckets(boardData: BoardData): Bucket[] {
  const buckets: Bucket[] = [];

  for (const b of boardData.backlog) {
    buckets.push({ id: `backlog-${b.key}`, title: b.label, sectionKey: b.key, cards: b.cards });
  }

  if (boardData.thisQuarter.length > 0) {
    buckets.push({ id: "backlog-this-quarter", title: "This Quarter", sectionKey: "this-quarter", cards: boardData.thisQuarter });
  }
  if (boardData.thisYear.length > 0) {
    buckets.push({ id: "backlog-this-year", title: "This Year", sectionKey: "this-year", cards: boardData.thisYear });
  }
  if (boardData.parkingLot.length > 0) {
    buckets.push({ id: "backlog-parking-lot", title: "Parking Lot", sectionKey: "parking-lot", cards: boardData.parkingLot });
  }

  return buckets;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high": return "var(--vscode-errorForeground)";
    case "medium": return "var(--vscode-editorWarning-foreground)";
    case "low": return "var(--vscode-charts-green)";
    default: return "var(--vscode-descriptionForeground)";
  }
}

function DroppableBucket({
  bucket,
  cards,
  onStatusClick,
}: {
  bucket: Bucket;
  cards: Card[];
  onStatusClick: (card: Card) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.id });

  return (
    <div
      className={`backlog-bucket ${isOver ? "backlog-bucket-over" : ""}`}
      ref={setNodeRef}
    >
      <h2 className="bucket-title">
        {bucket.title}
        <span className="bucket-count">{cards.length}</span>
      </h2>
      <div className="bucket-cards">
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.length > 0 ? (
            cards.map((card) => (
              <DraggableBacklogCard
                key={card.id}
                card={card}
                onStatusClick={onStatusClick}
              />
            ))
          ) : (
            <div className="empty-placeholder">No tasks</div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function DraggableBacklogCard({
  card,
  onStatusClick,
}: {
  card: Card;
  onStatusClick: (card: Card) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="backlog-card"
    >
      <button
        className="status-icon"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onStatusClick(card)}
        title={`Status: ${card.status} (click to change)`}
      >
        {card.status === "done" ? "✓" : card.status === "in-progress" ? "◐" : "○"}
      </button>
      <div className="backlog-card-content">
        <div className="card-title">{card.title}</div>
        <div className="card-badges">
          {card.project && (
            <span className="badge" style={{ color: "var(--vscode-charts-blue)" }}>
              {card.project}
            </span>
          )}
          {card.priority && (
            <span className="badge" style={{ color: getPriorityColor(card.priority) }}>
              {card.priority.toUpperCase()}
            </span>
          )}
          {card.timeEstimate && <span className="badge">{card.timeEstimate}</span>}
        </div>
        {card.subTasks.length > 0 && (
          <div className="backlog-subtask-summary">
            {card.subTasks.filter((st) => st.status === "done").length}/{card.subTasks.length} subtasks
          </div>
        )}
      </div>
    </div>
  );
}

export function BacklogView({ boardData, onCardMove, onCardMoveToSection }: BacklogViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const buckets = getBuckets(boardData);
  const allCards = buckets.flatMap((b) => b.cards);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleStatusClick = (card: Card) => {
    const nextStatus =
      card.status === "todo" ? "in-progress" :
      card.status === "in-progress" ? "done" : "todo";
    onCardMove(card.id, nextStatus);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const card = allCards.find((c) => c.id === cardId);
    if (!card) return;

    const overId = over.id as string;

    // Check if dropped on a bucket
    const targetBucket = buckets.find((b) => b.id === overId);
    if (targetBucket) {
      const sourceBucket = buckets.find((b) => b.cards.some((c) => c.id === cardId));
      if (sourceBucket && sourceBucket.id !== targetBucket.id) {
        onCardMoveToSection(cardId, targetBucket.sectionKey);
      }
      return;
    }

    // Dropped on a card — find which bucket it's in
    const targetCard = allCards.find((c) => c.id === overId);
    if (!targetCard) return;

    const sourceBucket = buckets.find((b) => b.cards.some((c) => c.id === cardId));
    const destBucket = buckets.find((b) => b.cards.some((c) => c.id === overId));

    if (sourceBucket && destBucket && sourceBucket.id !== destBucket.id) {
      onCardMoveToSection(cardId, destBucket.sectionKey);
    }
  };

  return (
    <div className="backlog-container">
      <SortBar sortKey={sortKey} onSortChange={setSortKey} />
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="backlog-view">
          {buckets.map((bucket) => {
            const sorted = sortCards(bucket.cards, sortKey);
            return (
              <DroppableBucket
                key={bucket.id}
                bucket={bucket}
                cards={sorted}
                onStatusClick={handleStatusClick}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
