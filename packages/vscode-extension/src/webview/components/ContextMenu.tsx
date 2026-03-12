import React, { useEffect, useRef } from "react";
import type { Card, BoardData } from "@hexfield-deck/core";

export type ContextMenuAction =
  | { type: "openInMarkdown" }
  | { type: "editTitle" }
  | { type: "editDueDate" }
  | { type: "editTimeEstimate" }
  | { type: "setPriority"; priority: "high" | "medium" | "low" | "none" }
  | { type: "changeState"; newStatus: "todo" | "in-progress" | "done" | "wont-do" | "blocked" }
  | { type: "moveToSection"; sectionHeading: string; boardHeading: string }
  | { type: "deleteTask" };

interface ContextMenuProps {
  card: Card;
  x: number;
  y: number;
  boardData: BoardData;
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  action?: ContextMenuAction;
  disabled?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
}

function getMenuItems(card: Card, boardData: BoardData): MenuItem[] {
  const items: MenuItem[] = [
    { label: "Open in Markdown", action: { type: "openInMarkdown" } },
    { label: "", separator: true },
    { label: "Edit Title...", action: { type: "editTitle" } },
    { label: "Edit Due Date...", action: { type: "editDueDate" } },
    { label: "Edit Time Estimate...", action: { type: "editTimeEstimate" } },
    { label: "", separator: true },
    {
      label: "Set Priority",
      submenu: [
        { label: "High", action: { type: "setPriority", priority: "high" } },
        { label: "Medium", action: { type: "setPriority", priority: "medium" } },
        { label: "Low", action: { type: "setPriority", priority: "low" } },
        { label: "None", action: { type: "setPriority", priority: "none" } },
      ],
    },
    {
      label: "Change State",
      submenu: [
        { label: "To Do", action: { type: "changeState", newStatus: "todo" } },
        { label: "In Progress", action: { type: "changeState", newStatus: "in-progress" } },
        { label: "Done", action: { type: "changeState", newStatus: "done" } },
        { label: "Won't Do", action: { type: "changeState", newStatus: "wont-do" } },
        { label: "Blocked", action: { type: "changeState", newStatus: "blocked" } },
      ],
    },
    { label: "", separator: true },
  ];

  // Flat "Move" submenu — all H2 rows across all Slates.
  // Prefix row label with slate name when multiple slates exist (avoids ambiguity).
  const multiBoard = boardData.boards.length > 1;
  const allRows = boardData.boards.flatMap((b) =>
    b.rows.map((r) => ({
      label: multiBoard
        ? `${b.heading || "Board"} — ${r.dayName ?? r.heading}`
        : r.dayName ?? r.heading,
      sectionHeading: r.heading,
      boardHeading: b.heading,
    }))
  );

  if (allRows.length > 0) {
    items.push({
      label: "Move",
      submenu: allRows.map((r) => ({
        label: r.label,
        action: {
          type: "moveToSection" as const,
          sectionHeading: r.sectionHeading,
          boardHeading: r.boardHeading,
        },
      })),
    });
  }

  items.push(
    { label: "", separator: true },
    { label: "Delete Task...", action: { type: "deleteTask" } },
  );

  return items;
}

interface MenuItemRowProps {
  item: MenuItem;
  onAction: (action: ContextMenuAction) => void;
}

function MenuItemRow({ item, onAction }: MenuItemRowProps) {
  if (item.separator) {
    return <div className="context-menu-separator" />;
  }

  const hasSubmenu = item.submenu && item.submenu.length > 0;
  const isDisabled = item.disabled;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDisabled || hasSubmenu) return;
    if (item.action) onAction(item.action);
  };

  return (
    <div
      className={`context-menu-item${isDisabled ? " context-menu-item-disabled" : ""}${hasSubmenu ? " context-menu-item-has-submenu" : ""}`}
      onClick={handleClick}
    >
      <span className="context-menu-item-label">{item.label}</span>
      {hasSubmenu && <span className="context-menu-arrow">▶</span>}
      {hasSubmenu && (
        <div className="context-menu context-submenu">
          {item.submenu!.map((sub, i) => (
            <MenuItemRow key={i} item={sub} onAction={onAction} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ContextMenu({ card, x, y, boardData, onAction, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Viewport edge detection for main menu
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;
    if (rect.right > vw) adjustedX = Math.max(0, x - rect.width);
    if (rect.bottom > vh) adjustedY = Math.max(0, y - rect.height);

    menuRef.current.style.left = `${adjustedX}px`;
    menuRef.current.style.top = `${adjustedY}px`;
  }, [x, y]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const menuItems = getMenuItems(card, boardData);

  const handleAction = (action: ContextMenuAction) => {
    onAction(action);
    onClose();
  };

  return (
    <div className="context-menu-overlay" onClick={onClose}>
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        {menuItems.map((item, i) => (
          <MenuItemRow key={i} item={item} onAction={handleAction} />
        ))}
      </div>
    </div>
  );
}
