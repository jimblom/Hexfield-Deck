import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card, SubTask } from "@hexfield-deck/core";

interface CardProps {
  card: Card;
  onToggleSubTask: (lineNumber: number) => void;
}

function getDueDateColor(dueDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "var(--vscode-errorForeground)";
  if (diffDays === 0) return "var(--vscode-editorWarning-foreground)";
  if (diffDays <= 3) return "var(--vscode-editorInfo-foreground)";
  return "var(--vscode-descriptionForeground)";
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "var(--vscode-errorForeground)";
    case "medium":
      return "var(--vscode-editorWarning-foreground)";
    case "low":
      return "var(--vscode-charts-green)";
    default:
      return "var(--vscode-descriptionForeground)";
  }
}

function Badge({
  label,
  color = "var(--vscode-descriptionForeground)",
}: {
  label: string;
  color?: string;
}) {
  return (
    <span className="badge" style={{ color }}>
      {label}
    </span>
  );
}

function SubTaskProgress({
  subTasks,
  onToggle,
}: {
  subTasks: SubTask[];
  onToggle: (lineNumber: number) => void;
}) {
  if (subTasks.length === 0) return null;

  const completed = subTasks.filter((st) => st.status === "done").length;
  const total = subTasks.length;
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className="subtask-progress">
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${percentage}%` }} />
      </div>
      <div className="progress-label">
        {completed}/{total} ({percentage}%)
      </div>
      <div className="subtask-list">
        {subTasks.map((st, idx) => {
          const icon =
            st.status === "done" ? "✓" : st.status === "in-progress" ? "◐" : "○";
          return (
            <div
              key={idx}
              className="subtask-item subtask-clickable"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onToggle(st.lineNumber)}
            >
              {icon} {st.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CardComponent({ card, onToggleSubTask }: CardProps) {
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
      className="card"
    >
      <div className="card-title">{card.title}</div>
      {(card.project || card.dueDate || card.priority || card.timeEstimate || card.day) && (
        <div className="card-badges">
          {card.project && (
            <Badge label={card.project} color="var(--vscode-charts-blue)" />
          )}
          {card.dueDate && (
            <Badge label={card.dueDate} color={getDueDateColor(card.dueDate)} />
          )}
          {card.priority && (
            <Badge
              label={card.priority.toUpperCase()}
              color={getPriorityColor(card.priority)}
            />
          )}
          {card.timeEstimate && <Badge label={card.timeEstimate} />}
          {card.day && <Badge label={card.day} />}
        </div>
      )}
      <SubTaskProgress subTasks={card.subTasks} onToggle={onToggleSubTask} />
    </div>
  );
}
