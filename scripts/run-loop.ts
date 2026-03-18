import { config } from "./shared/config.js";
import { createAiAdapter } from "./shared/ai-adapter.js";
import { writeLatestStatus, writeIterationLog } from "./shared/logger.js";
import { prepareInput } from "./prepare-input.js";
import { generateInitial } from "./generate-initial.js";
import { renderPage } from "./render-page.js";
import { compareImages } from "./compare-images.js";
import { analyzeDiff } from "./analyze-diff.js";
import { reviseCode } from "./revise-code.js";
import { finalizeRun } from "./finalize.js";

function nowIso(): string {
  return new Date().toISOString();
}

async function main(): Promise<void> {
  const adapter = createAiAdapter();
  const startTime = nowIso();

  let latestRenderPath: string | null = null;
  let latestDiffPath: string | null = null;
  let previousDiffRatio: number | null = null;
  let finalDiffRatio: number | null = null;
  let iterationsCompleted = 0;
  let stagnationCount = 0;
  let stopReason = "maxIterations reached";

  try {
    await writeLatestStatus({
      status: "running",
      phase: "prepare-input",
      iteration: 0,
      diffRatio: null,
      message: "Preparing input",
      timestamp: nowIso()
    });

    await prepareInput();

    await writeLatestStatus({
      status: "running",
      phase: "generate-initial",
      iteration: 0,
      diffRatio: null,
      message: "Generating initial HTML/CSS",
      timestamp: nowIso()
    });

    await generateInitial(adapter);

    for (let iteration = 1; iteration <= config.maxIterations; iteration += 1) {
      await writeLatestStatus({
        status: "running",
        phase: "render",
        iteration,
        diffRatio: finalDiffRatio,
        message: "Rendering current output",
        timestamp: nowIso()
      });
      latestRenderPath = await renderPage(iteration);

      await writeLatestStatus({
        status: "running",
        phase: "compare",
        iteration,
        diffRatio: finalDiffRatio,
        message: "Comparing render and source",
        timestamp: nowIso()
      });
      const comparison = await compareImages(iteration, latestRenderPath);
      latestDiffPath = comparison.diffPath;
      finalDiffRatio = comparison.metrics.diffRatio;

      await writeLatestStatus({
        status: "running",
        phase: "analyze",
        iteration,
        diffRatio: finalDiffRatio,
        message: "Analyzing diff",
        timestamp: nowIso()
      });
      const analysis = await analyzeDiff({
        adapter,
        renderPath: latestRenderPath,
        diffPath: latestDiffPath,
        metrics: comparison.metrics
      });

      const improvementFromPrevious =
        previousDiffRatio === null ? null : previousDiffRatio - comparison.metrics.diffRatio;

      await writeIterationLog({
        iteration,
        renderPath: latestRenderPath,
        diffPath: latestDiffPath,
        diffRatio: comparison.metrics.diffRatio,
        improvementFromPrevious,
        analysisSummary: analysis.summary,
        status: "success",
        timestamp: nowIso()
      });

      iterationsCompleted = iteration;

      if (comparison.metrics.diffRatio <= config.targetDiffRatio) {
        stopReason = "targetDiffRatio achieved";
        break;
      }

      if (
        improvementFromPrevious !== null &&
        improvementFromPrevious < config.minimumImprovement
      ) {
        stagnationCount += 1;
      } else {
        stagnationCount = 0;
      }

      if (stagnationCount >= 2) {
        stopReason = "improvement stagnated";
        break;
      }

      await writeLatestStatus({
        status: "running",
        phase: "revise",
        iteration,
        diffRatio: finalDiffRatio,
        message: "Revising HTML/CSS",
        timestamp: nowIso()
      });
      await reviseCode(adapter, analysis);

      previousDiffRatio = comparison.metrics.diffRatio;
    }

    await writeLatestStatus({
      status: "running",
      phase: "finalize",
      iteration: iterationsCompleted,
      diffRatio: finalDiffRatio,
      message: "Finalizing outputs",
      timestamp: nowIso()
    });

    await finalizeRun({
      latestRenderPath,
      latestDiffPath,
      startTime,
      endTime: nowIso(),
      status: "success",
      iterationsCompleted,
      finalDiffRatio,
      stopReason
    });

    await writeLatestStatus({
      status: "success",
      phase: "done",
      iteration: iterationsCompleted,
      diffRatio: finalDiffRatio,
      message: "Run completed",
      timestamp: nowIso()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await writeLatestStatus({
      status: "failed",
      phase: "done",
      iteration: iterationsCompleted,
      diffRatio: finalDiffRatio,
      message: errorMessage,
      timestamp: nowIso()
    });

    await finalizeRun({
      latestRenderPath,
      latestDiffPath,
      startTime,
      endTime: nowIso(),
      status: "failed",
      iterationsCompleted,
      finalDiffRatio,
      stopReason: "fatal error",
      error: errorMessage
    });

    throw error;
  }
}

main().catch(() => {
  process.exitCode = 1;
});
