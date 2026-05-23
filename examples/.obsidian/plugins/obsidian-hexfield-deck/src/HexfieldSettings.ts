export interface HexfieldColors {
  projectTag: string;
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

export interface HexfieldSettings {
  colors: HexfieldColors;
}

export const DEFAULT_SETTINGS: HexfieldSettings = {
  colors: {
    projectTag: "#569CD6",
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
};
