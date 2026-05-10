import React, { useState, useEffect, useRef } from "react";
import type { Card, Priority, TaskStatus } from "@hexfield-deck/core";

export type DueDateBucket = "overdue" | "today" | "this-week" | "none";
export type EstimateBucket = "none" | "short" | "medium" | "long";

export interface FilterState {
  projects: string[];
  tags: string[];
  priorities: Priority[];
  dueDates: DueDateBucket[];
  statuses: TaskStatus[];
  estimates: EstimateBucket[];
}

const DEFAULT_STATUSES: TaskStatus[] = ["todo", "in-progress", "done"];

export const EMPTY_FILTER: FilterState = {
  projects: [],
  tags: [],
  priorities: [],
  dueDates: [],
  statuses: DEFAULT_STATUSES,
  estimates: [],
};

function statusesMatchDefault(statuses: TaskStatus[]): boolean {
  return (
    statuses.length === DEFAULT_STATUSES.length &&
    DEFAULT_STATUSES.every((s) => statuses.includes(s))
  );
}

export function isFilterActive(f: FilterState): boolean {
  return (
    f.projects.length > 0 ||
    f.tags.length > 0 ||
    f.priorities.length > 0 ||
    f.dueDates.length > 0 ||
    !statusesMatchDefault(f.statuses) ||
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
  { value: "wont-do", label: "Won't Do" },
  { value: "blocked", label: "Blocked" },
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
  onChange: (filter: FilterState) => void;
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

export function FilterDropdown({ cards, filter, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const projects = [...new Set(cards.map((c) => c.project).filter((p): p is string => !!p))].sort();
  const tags = [...new Set(cards.flatMap((c) => c.tags ?? []))].sort();
  const statusDeviations = statusesMatchDefault(filter.statuses) ? 0 : 1;
  const activeCount = (
    filter.projects.length +
    filter.tags.length +
    filter.priorities.length +
    filter.dueDates.length +
    statusDeviations +
    filter.estimates.length
  );

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

  const set = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    onChange({ ...filter, [key]: val });

  return (
    <div className="filter-wrapper" ref={ref}>
      <button
        className={`filter-btn ${activeCount > 0 ? "active" : ""}`}
        onClick={() => setIsOpen((o) => !o)}
        title="Filter cards"
      >
        Filter {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
      </button>

      {isOpen && (
        <div className="filter-panel">
          <div className="filter-panel-header">
            <span>Filters</span>
            {isFilterActive(filter) && (
              <button
                className="filter-clear-btn"
                onClick={() => onChange(EMPTY_FILTER)}
              >
                Clear all
              </button>
            )}
          </div>

          {projects.length > 0 && (
            <div className="filter-section">
              <div className="filter-section-label">Project</div>
              {projects.map((p) => (
                <label key={p} className="filter-option">
                  <input
                    type="checkbox"
                    checked={filter.projects.includes(p)}
                    onChange={() => set("projects", toggle(filter.projects, p))}
                  />
                  {p}
                </label>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="filter-section">
              <div className="filter-section-label">Tags</div>
              {tags.map((t) => (
                <label key={t} className="filter-option">
                  <input
                    type="checkbox"
                    checked={filter.tags.includes(t)}
                    onChange={() => set("tags", toggle(filter.tags, t))}
                  />
                  #{t}
                </label>
              ))}
            </div>
          )}

          <div className="filter-section">
            <div className="filter-section-label">Status</div>
            {STATUS_OPTIONS.map((opt) => (
              <label key={opt.value} className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.statuses.includes(opt.value)}
                  onChange={() => set("statuses", toggle(filter.statuses, opt.value))}
                />
                {opt.label}
              </label>
            ))}
          </div>

          <div className="filter-section">
            <div className="filter-section-label">Priority</div>
            {PRIORITY_OPTIONS.map((opt) => (
              <label key={opt.value} className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.priorities.includes(opt.value)}
                  onChange={() => set("priorities", toggle(filter.priorities, opt.value))}
                />
                {opt.label}
              </label>
            ))}
          </div>

          <div className="filter-section">
            <div className="filter-section-label">Due Date</div>
            {DUE_DATE_OPTIONS.map((opt) => (
              <label key={opt.value} className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.dueDates.includes(opt.value)}
                  onChange={() => set("dueDates", toggle(filter.dueDates, opt.value))}
                />
                {opt.label}
              </label>
            ))}
          </div>

          <div className="filter-section">
            <div className="filter-section-label">Estimate</div>
            {ESTIMATE_OPTIONS.map((opt) => (
              <label key={opt.value} className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.estimates.includes(opt.value)}
                  onChange={() => set("estimates", toggle(filter.estimates, opt.value))}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
