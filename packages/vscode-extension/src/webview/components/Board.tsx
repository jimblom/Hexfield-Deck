import React, { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Column } from "./Column.js";
import { SortBar, sortCards } from "./SortBar.js";
import type { SortKey } from "./SortBar.js";
import type { Card, TaskStatus } from "@hexfield-deck/core";

interface BoardProps {
  cards: Card[];
  onCardMove: (cardId: string, newStatus: string) => void;
  onToggleSubTask: (lineNumber: number) => void;
}

export function Board({ cards, onCardMove, onToggleSubTask }: BoardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("default");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const cardId = active.id as string;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    let newStatus: TaskStatus;
    const overId = over.id as string;

    if (overId === "todo" || overId === "in-progress" || overId === "done") {
      newStatus = overId as TaskStatus;
    } else {
      const targetCard = cards.find((c) => c.id === overId);
      if (!targetCard) return;
      newStatus = targetCard.status;
    }

    if (card.status !== newStatus) {
      onCardMove(cardId, newStatus);
    }
  };

  const todoCards = sortCards(cards.filter((c) => c.status === "todo"), sortKey);
  const inProgressCards = sortCards(cards.filter((c) => c.status === "in-progress"), sortKey);
  const doneCards = sortCards(cards.filter((c) => c.status === "done"), sortKey);

  return (
    <>
      <SortBar sortKey={sortKey} onSortChange={setSortKey} />
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="board">
          <Column id="todo" title="To Do" cards={todoCards} onToggleSubTask={onToggleSubTask} />
          <Column id="in-progress" title="In Progress" cards={inProgressCards} onToggleSubTask={onToggleSubTask} />
          <Column id="done" title="Done" cards={doneCards} onToggleSubTask={onToggleSubTask} />
        </div>
      </DndContext>
    </>
  );
}
