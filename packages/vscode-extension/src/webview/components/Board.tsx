import React from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Column } from "./Column.js";
import type { Card, TaskStatus } from "@hexfield-deck/core";

interface BoardProps {
  cards: Card[];
  onCardMove: (cardId: string, newStatus: string) => void;
  onToggleSubTask: (lineNumber: number) => void;
}

export function Board({ cards, onCardMove, onToggleSubTask }: BoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const cardId = active.id as string;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    // Determine the target status
    // If dropped on a column, use the column ID
    // If dropped on a card, use that card's status
    let newStatus: TaskStatus;
    const overId = over.id as string;

    if (overId === "todo" || overId === "in-progress" || overId === "done") {
      // Dropped on a column
      newStatus = overId as TaskStatus;
    } else {
      // Dropped on a card - find that card's status
      const targetCard = cards.find((c) => c.id === overId);
      if (!targetCard) return;
      newStatus = targetCard.status;
    }

    // Only update if status actually changed
    if (card.status !== newStatus) {
      onCardMove(cardId, newStatus);
    }
  };

  // Group cards by status
  const todoCards = cards.filter((c) => c.status === "todo");
  const inProgressCards = cards.filter((c) => c.status === "in-progress");
  const doneCards = cards.filter((c) => c.status === "done");

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="board">
        <Column id="todo" title="To Do" cards={todoCards} onToggleSubTask={onToggleSubTask} />
        <Column id="in-progress" title="In Progress" cards={inProgressCards} onToggleSubTask={onToggleSubTask} />
        <Column id="done" title="Done" cards={doneCards} onToggleSubTask={onToggleSubTask} />
      </div>
    </DndContext>
  );
}
