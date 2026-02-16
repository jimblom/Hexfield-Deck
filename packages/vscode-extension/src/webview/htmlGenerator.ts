import type { BoardData, Card, SubTask } from "@hexfield-deck/core";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getDueDateColor(dueDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "var(--vscode-errorForeground)"; // overdue - red
  } else if (diffDays === 0) {
    return "var(--vscode-editorWarning-foreground)"; // today - orange
  } else if (diffDays <= 3) {
    return "var(--vscode-editorInfo-foreground)"; // upcoming - yellow/blue
  } else {
    return "var(--vscode-descriptionForeground)"; // future - gray
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "var(--vscode-errorForeground)"; // red
    case "medium":
      return "var(--vscode-editorWarning-foreground)"; // orange/yellow
    case "low":
      return "var(--vscode-charts-green)"; // green
    default:
      return "var(--vscode-descriptionForeground)";
  }
}

function renderBadge(
  label: string,
  color: string = "var(--vscode-descriptionForeground)",
): string {
  return `<span class="badge" style="color: ${color};">${escapeHtml(label)}</span>`;
}

function renderCardBadges(card: Card): string {
  const badges: string[] = [];

  if (card.project) {
    badges.push(
      renderBadge(card.project, "var(--vscode-charts-blue)"), // blue for projects
    );
  }

  if (card.dueDate) {
    const color = getDueDateColor(card.dueDate);
    badges.push(renderBadge(card.dueDate, color));
  }

  if (card.priority) {
    const color = getPriorityColor(card.priority);
    const label = card.priority.toUpperCase();
    badges.push(renderBadge(label, color));
  }

  if (card.timeEstimate) {
    badges.push(renderBadge(card.timeEstimate));
  }

  if (card.day) {
    badges.push(renderBadge(card.day));
  }

  return badges.join("");
}

function renderSubTaskProgress(subTasks: SubTask[]): string {
  if (subTasks.length === 0) {
    return "";
  }

  const completed = subTasks.filter((st) => st.status === "done").length;
  const total = subTasks.length;
  const percentage = Math.round((completed / total) * 100);

  const checklistItems = subTasks
    .map((st) => {
      const icon = st.status === "done" ? "✓" : st.status === "in-progress" ? "◐" : "○";
      return `<div class="subtask-item">${icon} ${escapeHtml(st.text)}</div>`;
    })
    .join("");

  return `
    <div class="subtask-progress">
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${percentage}%;"></div>
      </div>
      <div class="progress-label">${completed}/${total} (${percentage}%)</div>
    </div>
    <div class="subtask-list">
      ${checklistItems}
    </div>
  `;
}

function renderCard(card: Card): string {
  const badges = renderCardBadges(card);
  const subTaskProgress = renderSubTaskProgress(card.subTasks);

  return `
    <div class="card">
      <div class="card-title">${escapeHtml(card.title)}</div>
      ${badges ? `<div class="card-badges">${badges}</div>` : ""}
      ${subTaskProgress}
    </div>
  `;
}

function renderColumn(title: string, cards: Card[]): string {
  const cardHtml =
    cards.length > 0
      ? cards.map((c) => renderCard(c)).join("")
      : '<div class="empty-placeholder">No tasks</div>';

  return `
    <div class="column">
      <h2 class="column-title">${title}</h2>
      <div class="cards">
        ${cardHtml}
      </div>
    </div>
  `;
}

export function getWebviewHtml(board: BoardData, cards: Card[]): string {
  // Group cards by status
  const todoCards = cards.filter((c) => c.status === "todo");
  const inProgressCards = cards.filter((c) => c.status === "in-progress");
  const doneCards = cards.filter((c) => c.status === "done");

  const week = board.frontmatter.week || 0;
  const year = board.frontmatter.year || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Hexfield Deck</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
    }

    .header {
      margin-bottom: 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 16px;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--vscode-foreground);
    }

    .header .subtitle {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
    }

    .board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .column {
      background-color: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
      min-height: 200px;
    }

    .column-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--vscode-foreground);
    }

    .cards {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .card {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
    }

    .card:hover {
      border-color: var(--vscode-focusBorder);
    }

    .card-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--vscode-foreground);
    }

    .card-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }

    .badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 3px;
      background-color: var(--vscode-badge-background);
      font-family: var(--vscode-font-family);
    }

    .subtask-progress {
      margin-top: 8px;
      margin-bottom: 6px;
    }

    .progress-bar-container {
      width: 100%;
      height: 4px;
      background-color: var(--vscode-panel-border);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 4px;
    }

    .progress-bar {
      height: 100%;
      background-color: var(--vscode-charts-green);
      transition: width 0.2s ease;
    }

    .progress-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .subtask-list {
      margin-top: 6px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .subtask-item {
      padding: 2px 0;
      font-family: var(--vscode-editor-font-family);
    }

    .empty-placeholder {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Hexfield Deck</h1>
    <div class="subtitle">Week ${week}, ${year}</div>
  </div>
  <div class="board">
    ${renderColumn("To Do", todoCards)}
    ${renderColumn("In Progress", inProgressCards)}
    ${renderColumn("Done", doneCards)}
  </div>
</body>
</html>`;
}
