import { config } from "./shared/config.js";
import type { AiAdapter } from "./shared/ai-adapter.js";
import type { DiffAnalysis, DiffMetrics } from "./shared/types.js";

export async function analyzeDiff(params: {
  adapter: AiAdapter;
  renderPath: string;
  diffPath: string;
  metrics: DiffMetrics;
}): Promise<DiffAnalysis> {
  const analysis = await params.adapter.analyzeDiff({
    imagePath: config.inputImagePath,
    renderPath: params.renderPath,
    diffPath: params.diffPath,
    metrics: params.metrics,
    promptPath: config.prompts.diffAnalysis
  });

  if (!analysis.issues || analysis.issues.length === 0) {
    return {
      summary: analysis.summary || "No issues returned by analyzer.",
      issues: [
        {
          category: "unknown",
          severity: "medium",
          description: "Analyzer returned no issues.",
          suggestedAction: "Re-check layout, spacing, alignment, typography, and colors."
        }
      ]
    };
  }

  return analysis;
}
