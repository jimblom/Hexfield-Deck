import React from "react";
import type { Board } from "@hexfield-deck/core";

interface SlateSelectorProps {
  boards: Board[];
  activeIndex: number;
  onChange: (index: number) => void;
}

/**
 * Slate selector — navigates between H1 boards (Slates) in the planner file.
 * Renders a dropdown when multiple slates exist, or a plain title for a single slate.
 */
export function SlateSelector({ boards, activeIndex, onChange }: SlateSelectorProps) {
  if (boards.length <= 1) {
    return (
      <span className="slate-title">
        {boards[0]?.heading || "Board"}
      </span>
    );
  }

  return (
    <select
      className="slate-selector"
      value={activeIndex}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Select slate"
    >
      {boards.map((board, i) => (
        <option key={i} value={i}>
          {board.heading || "Board"}
        </option>
      ))}
    </select>
  );
}
