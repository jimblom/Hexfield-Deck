import type { BoardData, Card } from "@hexfield-deck/core";

export type ColorConfig = Record<string, string>;

export interface TagConfig {
  color?: string;
  style?: "border" | "fill" | "both";
}

/** The payload sent from the host to the UI on every board update. */
export interface UpdatePayload {
  boardData: BoardData;
  cards: Card[];
  isDirty?: boolean;
  colors?: ColorConfig;
  tagConfig?: Record<string, TagConfig>;
  tagPriorityList?: string[];
}

export type HostState = Record<string, unknown>;

/** All message types the UI can send to the host platform. */
export type OutboundMessage =
  | { type: "ready" }
  | { type: "moveCard"; cardId: string; newStatus: string }
  | { type: "moveCardToSection"; cardId: string; sectionHeading: string; boardHeading: string; newStatus?: string }
  | { type: "toggleSubTask"; lineNumber: number }
  | { type: "openInMarkdown"; cardId: string }
  | { type: "editTitle"; cardId: string }
  | { type: "editDueDate"; cardId: string }
  | { type: "editTimeEstimate"; cardId: string }
  | { type: "setPriority"; cardId: string; priority: string }
  | { type: "deleteTask"; cardId: string }
  | { type: "addTask"; sectionHeading: string; boardHeading?: string }
  | { type: "openLink"; url: string }
  | { type: "updateTagConfig"; tagConfig: Record<string, TagConfig>; tagPriorityList: string[] };

/**
 * Platform abstraction for the board UI. Implementations exist for VS Code
 * (VsCodeBridge) and Obsidian (ObsidianBridge). Components call bridge.send()
 * and bridge.onUpdate() — they have no knowledge of the host platform.
 */
export interface HostBridge {
  /** Send a message from the UI to the host platform. */
  send(message: OutboundMessage): void;
  /**
   * Register a handler for board update payloads pushed by the host.
   * Returns an unsubscribe function.
   */
  onUpdate(handler: (payload: UpdatePayload) => void): () => void;
  /** Retrieve persisted UI state (viewMode, slateIndex). Returns null if unavailable. */
  getState(): HostState | null;
  /** Persist UI state across panel reloads. */
  setState(state: HostState): void;
}
