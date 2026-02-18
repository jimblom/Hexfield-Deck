import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CardComponent } from "./Card.js";
import type { Card } from "@hexfield-deck/core";

interface ColumnProps {
  id: string;
  title: string;
  cards: Card[];
  onToggleSubTask: (lineNumber: number) => void;
}

export function Column({ id, title, cards, onToggleSubTask }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="column" ref={setNodeRef}>
      <h2 className="column-title">{title}</h2>
      <div className="cards">
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.length > 0 ? (
            cards.map((card) => <CardComponent key={card.id} card={card} onToggleSubTask={onToggleSubTask} />)
          ) : (
            <div className="empty-placeholder">No tasks</div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
