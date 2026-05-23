import type { TagConfig } from "../HostBridge.js";

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Returns color + style for the first tag in priorityList that has a configured color. */
export function getPrimaryTagColor(
  tags: string[],
  tagConfig: Record<string, TagConfig>,
  priorityList: string[],
): { color: string; style: "border" | "fill" | "both" } | undefined {
  for (const tag of priorityList) {
    const cfg = tagConfig[tag];
    if (tags.includes(tag) && cfg?.color) {
      return { color: cfg.color, style: cfg.style ?? "border" };
    }
  }
  return undefined;
}
