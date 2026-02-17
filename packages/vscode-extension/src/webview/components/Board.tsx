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
}

export function Board({ cards, onCardMove }: BoardProps) {
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
    const newStatus = over.id as TaskStatus;

    // Find the card being moved
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

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
        <Column id="todo" title="To Do" cards={todoCards} />
        <Column id="in-progress" title="In Progress" cards={inProgressCards} />
        <Column id="done" title="Done" cards={doneCards} />
      </div>
    </DndContext>
  );
}
