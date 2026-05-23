import React, { useContext, useState } from "react";
import { MarkdownTitle } from "./MarkdownTitle.js";
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
import { TagContext, TagPriorityContext } from "./App.js";
import { hexToRgba, getPrimaryTagColor } from "../utils/tagColors.js";

interface BacklogViewProps {
  boardData: BoardData;
  onCardMove: (cardId: string, newStatus: string) => void;
  onCardMoveToSection: (
    cardId: string,
    sectionHeading: string,
    boardHeading: string,
  ) => void;
}

interface BucketItem {
  id: string;
  title: string;
  sectionHeading: string;
  boardHeading: string;
  cards: Card[];
}

/** All non-day rows across all boards become backlog buckets. */
function getBuckets(boardData: BoardData): BucketItem[] {
  const items: BucketItem[] = [];
  for (const board of boardData.boards) {
    for (const row of board.rows) {
      if (row.dayName) continue; // skip day rows
      items.push({
        id: `${board.heading}::${row.heading}`,
        title: row.heading,
        sectionHeading: row.heading,
        boardHeading: board.heading,
        cards: row.cards,
      });
    }
  }
  return items;
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
  bucket: BucketItem;
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
  const tagConfig = useContext(TagContext);
  const priorityList = useContext(TagPriorityContext);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const primaryTag = getPrimaryTagColor(card.tags ?? [], tagConfig, priorityList);
  const accentColor = primaryTag?.color;
  const colorStyle = primaryTag?.style ?? "border";

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(accentColor && (colorStyle === "border" || colorStyle === "both")
      ? { borderLeft: `3px solid ${accentColor}` } : {}),
    ...(accentColor && (colorStyle === "fill" || colorStyle === "both")
      ? { backgroundColor: hexToRgba(accentColor, 0.1) } : {}),
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
        <MarkdownTitle title={card.title} />
        {(card.priority || card.timeEstimate || (card.tags && card.tags.length > 0)) && (
          <div className="card-meta">
            {(card.priority || card.timeEstimate) && (
              <div className="card-badges">
                {card.priority && (
                  <span className="badge" style={{ color: getPriorityColor(card.priority) }}>
                    {card.priority.toUpperCase()}
                  </span>
                )}
                {card.timeEstimate && <span className="badge">{card.timeEstimate}</span>}
              </div>
            )}
            {card.tags && card.tags.length > 0 && (
              <div className="card-tags">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="tag-pill"
                    style={tagConfig[tag]?.color ? {
                      borderColor: tagConfig[tag].color,
                      color: tagConfig[tag].color,
                    } : undefined}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
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
        onCardMoveToSection(cardId, targetBucket.sectionHeading, targetBucket.boardHeading);
      }
      return;
    }

    // Dropped on a card — find which bucket it's in
    const targetCard = allCards.find((c) => c.id === overId);
    if (!targetCard) return;

    const sourceBucket = buckets.find((b) => b.cards.some((c) => c.id === cardId));
    const destBucket = buckets.find((b) => b.cards.some((c) => c.id === overId));

    if (sourceBucket && destBucket && sourceBucket.id !== destBucket.id) {
      onCardMoveToSection(cardId, destBucket.sectionHeading, destBucket.boardHeading);
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
