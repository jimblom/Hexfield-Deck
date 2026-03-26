import React from "react";
import type { Card, Priority } from "@hexfield-deck/core";

export type SortKey = "default" | "priority" | "status" | "project" | "estimate";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "default", label: "File order" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "project", label: "Project" },
  { key: "estimate", label: "Estimate" },
];

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER: Record<string, number> = { "in-progress": 0, "todo": 1, "done": 2 };

function parseEstimateMinutes(est?: string): number {
  if (!est) return Infinity;
  let total = 0;
  const hours = est.match(/(\d+)h/);
  const mins = est.match(/(\d+)m/);
  if (hours) total += parseInt(hours[1]) * 60;
  if (mins) total += parseInt(mins[1]);
  return total || Infinity;
}

export function sortCards(cards: Card[], sortKey: SortKey): Card[] {
  if (sortKey === "default") return cards;

  return [...cards].sort((a, b) => {
    switch (sortKey) {
      case "priority": {
        const ap = PRIORITY_ORDER[a.priority as Priority] ?? 3;
        const bp = PRIORITY_ORDER[b.priority as Priority] ?? 3;
        return ap - bp;
      }
      case "status": {
        const as_ = STATUS_ORDER[a.status] ?? 3;
        const bs = STATUS_ORDER[b.status] ?? 3;
        return as_ - bs;
      }
      case "project": {
        const ap = a.project || "\uffff";
        const bp = b.project || "\uffff";
        return ap.localeCompare(bp);
      }
      case "estimate": {
        return parseEstimateMinutes(a.timeEstimate) - parseEstimateMinutes(b.timeEstimate);
      }
      default:
        return 0;
    }
  });
}

interface SortBarProps {
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
}

export function SortBar({ sortKey, onSortChange }: SortBarProps) {
  return (
    <div className="sort-bar">
      <label className="sort-label">Sort:</label>
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          className={`sort-btn ${sortKey === opt.key ? "active" : ""}`}
          onClick={() => onSortChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
