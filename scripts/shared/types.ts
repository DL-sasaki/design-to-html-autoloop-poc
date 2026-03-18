export type DiffMetrics = {
  totalPixels: number;
  differentPixels: number;
  diffRatio: number;
  width: number;
  height: number;
};

export type DiffAnalysis = {
  summary: string;
  issues: Array<{
    category:
      | "missing-element"
      | "spacing"
      | "font-size"
      | "alignment"
      | "color"
      | "layout-proportion"
      | "unknown";
    severity: "low" | "medium" | "high";
    description: string;
    suggestedAction: string;
  }>;
};

export type IterationLog = {
  iteration: number;
  renderPath: string;
  diffPath: string;
  diffRatio: number;
  improvementFromPrevious: number | null;
  analysisSummary: string;
  status: "success" | "failed";
  timestamp: string;
};

export type RunStatus = "running" | "success" | "failed";

export type LatestStatus = {
  status: RunStatus;
  phase:
    | "prepare-input"
    | "generate-initial"
    | "render"
    | "compare"
    | "analyze"
    | "revise"
    | "finalize"
    | "done";
  iteration: number;
  diffRatio: number | null;
  message: string;
  timestamp: string;
};

export type RunSummary = {
  startTime: string;
  endTime: string;
  status: RunStatus;
  iterationsCompleted: number;
  finalDiffRatio: number | null;
  stopReason: string;
  artifacts: {
    htmlPath: string;
    cssPath: string;
    finalRenderPath: string | null;
    finalDiffPath: string | null;
  };
  error?: string;
};
