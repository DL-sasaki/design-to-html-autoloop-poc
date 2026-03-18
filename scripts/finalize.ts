import path from "node:path";
import { config } from "./shared/config.js";
import { copyArtifact } from "./shared/file-utils.js";
import { writeRunSummary } from "./shared/logger.js";
import type { RunSummary } from "./shared/types.js";

export async function finalizeRun(input: {
  latestRenderPath: string | null;
  latestDiffPath: string | null;
  startTime: string;
  endTime: string;
  status: "success" | "failed";
  iterationsCompleted: number;
  finalDiffRatio: number | null;
  stopReason: string;
  error?: string;
}): Promise<void> {
  const finalRenderPath = path.join(config.directories.renders, "final.png");
  const finalDiffPath = path.join(config.directories.diff, "final-diff.png");

  if (input.latestRenderPath) {
    await copyArtifact(input.latestRenderPath, finalRenderPath);
  }

  if (input.latestDiffPath) {
    await copyArtifact(input.latestDiffPath, finalDiffPath);
  }

  const summary: RunSummary = {
    startTime: input.startTime,
    endTime: input.endTime,
    status: input.status,
    iterationsCompleted: input.iterationsCompleted,
    finalDiffRatio: input.finalDiffRatio,
    stopReason: input.stopReason,
    artifacts: {
      htmlPath: config.outputHtmlPath,
      cssPath: config.outputCssPath,
      finalRenderPath: input.latestRenderPath ? finalRenderPath : null,
      finalDiffPath: input.latestDiffPath ? finalDiffPath : null
    },
    ...(input.error ? { error: input.error } : {})
  };

  await writeRunSummary(summary);
}
