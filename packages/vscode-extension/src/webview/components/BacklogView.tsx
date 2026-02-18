import React from "react";
import type { BoardData, Card } from "@hexfield-deck/core";

interface BacklogViewProps {
  boardData: BoardData;
  onCardMove: (cardId: string, newStatus: string) => void;
}

interface Bucket {
  id: string;
  title: string;
  cards: Card[];
}

function getBuckets(boardData: BoardData): Bucket[] {
  const buckets: Bucket[] = [];

  for (const b of boardData.backlog) {
    buckets.push({ id: `backlog-${b.key}`, title: b.label, cards: b.cards });
  }

  if (boardData.thisQuarter.length > 0) {
    buckets.push({ id: "backlog-this-quarter", title: "This Quarter", cards: boardData.thisQuarter });
  }
  if (boardData.thisYear.length > 0) {
    buckets.push({ id: "backlog-this-year", title: "This Year", cards: boardData.thisYear });
  }
  if (boardData.parkingLot.length > 0) {
    buckets.push({ id: "backlog-parking-lot", title: "Parking Lot", cards: boardData.parkingLot });
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

export function BacklogView({ boardData, onCardMove }: BacklogViewProps) {
  const buckets = getBuckets(boardData);

  const handleStatusClick = (card: Card) => {
    // Cycle status: todo → in-progress → done → todo
    const nextStatus =
      card.status === "todo" ? "in-progress" :
      card.status === "in-progress" ? "done" : "todo";
    onCardMove(card.id, nextStatus);
  };

  return (
    <div className="backlog-view">
      {buckets.map((bucket) => (
        <div key={bucket.id} className="backlog-bucket">
          <h2 className="bucket-title">
            {bucket.title}
            <span className="bucket-count">{bucket.cards.length}</span>
          </h2>
          <div className="bucket-cards">
            {bucket.cards.length > 0 ? (
              bucket.cards.map((card) => (
                <div key={card.id} className="backlog-card">
                  <button
                    className="status-icon"
                    onClick={() => handleStatusClick(card)}
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
              ))
            ) : (
              <div className="empty-placeholder">No tasks</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
