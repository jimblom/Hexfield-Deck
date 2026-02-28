import React, { useContext } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { marked } from "marked";
import type { Card, SubTask } from "@hexfield-deck/core";
import { ContextMenuContext, ProjectContext } from "./App.js";
import type { ProjectConfig } from "./App.js";
import { MarkdownTitle } from "./MarkdownTitle.js";

interface CardProps {
  card: Card;
  onToggleSubTask: (lineNumber: number) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const projectsConfig = useContext(ProjectContext);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const projectCfg: ProjectConfig | undefined = card.project ? projectsConfig[card.project] : undefined;

  const color = projectCfg?.color;
  const colorStyle = projectCfg?.style ?? "border";
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
      className="card"
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenu(card, { x: e.clientX, y: e.clientY });
      }}
    >
      <MarkdownTitle title={card.title} />
      {(card.project || card.dueDate || card.priority || card.timeEstimate || card.day) && (
        <div className="card-badges">
          {card.project && (
            projectCfg?.url ? (
              <a
                className="badge"
                href={projectCfg.url}
                style={{ color: "var(--hx-project-tag, #569CD6)" }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {card.project}
              </a>
            ) : (
              <Badge label={card.project} color="var(--hx-project-tag, #569CD6)" />
            )
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
          {card.timeEstimate && (
            <Badge label={card.timeEstimate} color="var(--hx-time-estimate, #4EC9B0)" />
          )}
          {card.day && <Badge label={card.day} />}
        </div>
      )}
      <SubTaskProgress subTasks={card.subTasks} onToggle={onToggleSubTask} />
    </div>
  );
}
