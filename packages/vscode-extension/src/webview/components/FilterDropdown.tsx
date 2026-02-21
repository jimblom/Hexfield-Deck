import React, { useState, useEffect, useRef } from "react";
import type { Card, Priority, TaskStatus } from "@hexfield-deck/core";

export type DueDateBucket = "overdue" | "today" | "this-week" | "none";
export type EstimateBucket = "none" | "short" | "medium" | "long";

export interface FilterState {
  projects: string[];
  priorities: Priority[];
  dueDates: DueDateBucket[];
  statuses: TaskStatus[];
  estimates: EstimateBucket[];
}

export const EMPTY_FILTER: FilterState = {
  projects: [],
  priorities: [],
  dueDates: [],
  statuses: [],
  estimates: [],
};

export function isFilterActive(f: FilterState): boolean {
  return (
    f.projects.length > 0 ||
    f.priorities.length > 0 ||
    f.dueDates.length > 0 ||
    f.statuses.length > 0 ||
    f.estimates.length > 0
  );
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const DUE_DATE_OPTIONS: { value: DueDateBucket; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due Today" },
  { value: "this-week", label: "Due This Week" },
  { value: "none", label: "No Due Date" },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const ESTIMATE_OPTIONS: { value: EstimateBucket; label: string }[] = [
  { value: "short", label: "Short (≤30m)" },
  { value: "medium", label: "Medium (30m–2h)" },
  { value: "long", label: "Long (2h+)" },
  { value: "none", label: "No Estimate" },
];

interface FilterDropdownProps {
  cards: Card[];
  filter: FilterState;
  onChange: (f: FilterState) => void;
}

export function FilterDropdown({ cards, filter, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Derive unique sorted project list from all (unfiltered) cards
  const projects = [
    ...new Set(cards.map((c) => c.project).filter((p): p is string => !!p)),
  ].sort();

  const activeCount =
    filter.projects.length +
    filter.priorities.length +
    filter.dueDates.length +
    filter.statuses.length +
    filter.estimates.length;

  // Close panel on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  function toggleProject(p: string) {
    const next = filter.projects.includes(p)
      ? filter.projects.filter((x) => x !== p)
      : [...filter.projects, p];
    onChange({ ...filter, projects: next });
  }

  function togglePriority(p: Priority) {
    const next = filter.priorities.includes(p)
      ? filter.priorities.filter((x) => x !== p)
      : [...filter.priorities, p];
    onChange({ ...filter, priorities: next });
  }

  function toggleDueDate(d: DueDateBucket) {
    const next = filter.dueDates.includes(d)
      ? filter.dueDates.filter((x) => x !== d)
      : [...filter.dueDates, d];
    onChange({ ...filter, dueDates: next });
  }

  function toggleStatus(s: TaskStatus) {
    const next = filter.statuses.includes(s)
      ? filter.statuses.filter((x) => x !== s)
      : [...filter.statuses, s];
    onChange({ ...filter, statuses: next });
  }

  function toggleEstimate(e: EstimateBucket) {
    const next = filter.estimates.includes(e)
      ? filter.estimates.filter((x) => x !== e)
      : [...filter.estimates, e];
    onChange({ ...filter, estimates: next });
  }

  return (
    <div className="filter-wrapper" ref={ref}>
      <button
        className={`filter-btn ${isFilterActive(filter) ? "active" : ""}`}
        onClick={() => setIsOpen((o) => !o)}
        title="Filter cards"
      >
        Filter
        {activeCount > 0 && (
          <span className="filter-badge">{activeCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="filter-panel">
          {projects.length > 0 && (
            <div className="filter-section">
              <div className="filter-section-label">Project</div>
              {projects.map((p) => (
                <label key={p} className="filter-option">
                  <input
                    type="checkbox"
                    checked={filter.projects.includes(p)}
                    onChange={() => toggleProject(p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          )}

          <div className="filter-section">
            <div className="filter-section-label">Status</div>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <label key={value} className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.statuses.includes(value)}
                  onChange={() => toggleStatus(value)}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="filter-section">
            <div className="filter-section-label">Priority</div>
            {PRIORITY_OPTIONS.map(({ value, label }) => (
              <label key={value} className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.priorities.includes(value)}
                  onChange={() => togglePriority(value)}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="filter-section">
            <div className="filter-section-label">Due Date</div>
            {DUE_DATE_OPTIONS.map(({ value, label }) => (
              <label key={value} className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.dueDates.includes(value)}
                  onChange={() => toggleDueDate(value)}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="filter-section">
            <div className="filter-section-label">Time Estimate</div>
            {ESTIMATE_OPTIONS.map(({ value, label }) => (
              <label key={value} className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.estimates.includes(value)}
                  onChange={() => toggleEstimate(value)}
                />
                {label}
              </label>
            ))}
          </div>

          {isFilterActive(filter) && (
            <button
              className="filter-clear-btn"
              onClick={() => onChange(EMPTY_FILTER)}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
