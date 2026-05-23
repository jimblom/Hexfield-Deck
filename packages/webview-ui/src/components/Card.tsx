import React, { useContext } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { marked } from "marked";
import type { Card, SubTask } from "@hexfield-deck/core";
import { ContextMenuContext, TagContext, TagPriorityContext, JumpToSourceContext } from "./App.js";
import { hexToRgba, getPrimaryTagColor } from "../utils/tagColors.js";
import { MarkdownTitle } from "./MarkdownTitle.js";

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

  if (diffDays < 0) return "var(--hx-due-overdue, #F44747)";
  if (diffDays === 0) return "var(--hx-due-today, #CE9178)";
  if (diffDays >= 1 && diffDays <= 3) return "var(--hx-due-soon, #CCA700)";
  return "var(--hx-due-future, #858585)";
}

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "var(--hx-priority-high, #F44747)";
    case "medium":
      return "var(--hx-priority-med, #CCA700)";
    case "low":
      return "var(--hx-priority-low, #89D185)";
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
              onClick={(e) => {
                e.stopPropagation();
                if ((e.target as HTMLElement).closest("a")) return;
                onToggle(st.lineNumber);
              }}
              dangerouslySetInnerHTML={{ __html: `${icon} ${marked.parseInline(st.text) as string}` }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function CardComponent({ card, onToggleSubTask }: CardProps) {
  const openContextMenu = useContext(ContextMenuContext);
  const jumpToSource = useContext(JumpToSourceContext);
  const tagConfig = useContext(TagContext);
  const priorityList = useContext(TagPriorityContext);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const primaryTag = getPrimaryTagColor(card.tags ?? [], tagConfig, priorityList);
  const color = primaryTag?.color;
  const colorStyle = primaryTag?.style ?? "border";
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(color && (colorStyle === "border" || colorStyle === "both")
      ? { borderLeft: `3px solid ${color}` } : {}),
    ...(color && (colorStyle === "fill" || colorStyle === "both")
      ? { backgroundColor: hexToRgba(color, 0.1) } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`card${isOverdue(card.dueDate) ? " card-overdue" : ""}`}
      onClick={() => jumpToSource(card.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenu(card, { x: e.clientX, y: e.clientY });
      }}
    >
      <MarkdownTitle title={card.title} />
      {card.comment && (
        <div className="card-comment">{card.comment}</div>
      )}
      {(card.dueDate || card.priority || card.timeEstimate || card.day || (card.tags && card.tags.length > 0)) && (
        <div className="card-meta">
          {(card.dueDate || card.priority || card.timeEstimate || card.day) && (
            <div className="card-badges">
              {card.dueDate && (
                <Badge label={card.dueDate} color={getDueDateColor(card.dueDate)} />
              )}
              {card.priority && (
                <Badge
                  label={card.priority.toUpperCase()}
                  color={getPriorityColor(card.priority)}
                />
              )}
              {card.timeEstimate && (
                <Badge label={card.timeEstimate} color="var(--hx-time-estimate, #4EC9B0)" />
              )}
              {card.day && <Badge label={card.day} />}
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
      <SubTaskProgress subTasks={card.subTasks} onToggle={onToggleSubTask} />
    </div>
  );
}
