export interface HexfieldColors {
  tagColor: string;
  priorityHigh: string;
  priorityMed: string;
  priorityLow: string;
  timeEstimate: string;
  inProgressCheckbox: string;
  dueDateOverdue: string;
  dueDateToday: string;
  dueDateSoon: string;
  dueDateFuture: string;
  doneTask: string;
  lineComment: string;
}

export interface HexfieldTagSettings {
  tagConfig: Record<string, { color?: string; style?: "border" | "fill" | "both" }>;
  tagPriorityList: string[];
}

export interface HexfieldSettings {
  colors: HexfieldColors;
  tags: HexfieldTagSettings;
}

export const DEFAULT_SETTINGS: HexfieldSettings = {
  colors: {
    tagColor: "#858585",
    priorityHigh: "#F44747",
    priorityMed: "#CCA700",
    priorityLow: "#89D185",
    timeEstimate: "#4EC9B0",
    inProgressCheckbox: "#CE9178",
    dueDateOverdue: "#F44747",
    dueDateToday: "#CE9178",
    dueDateSoon: "#CCA700",
    dueDateFuture: "#858585",
    doneTask: "#6B737C",
    lineComment: "#6A9955",
  },
  tags: {
    tagConfig: {},
    tagPriorityList: [],
  },
};
