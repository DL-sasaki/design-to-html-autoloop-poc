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

async function reportProgress(input: {
  status: "running" | "success" | "failed";
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
}): Promise<void> {
  const payload = {
    ...input,
    timestamp: nowIso()
  };

  await writeLatestStatus(payload);

  const diffPart =
    payload.diffRatio === null ? "diff=n/a" : `diff=${payload.diffRatio.toFixed(4)}`;
  console.log(
    `[${payload.status.toUpperCase()}] iter=${payload.iteration} phase=${payload.phase} ${diffPart} msg="${payload.message}"`
  );
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
    await reportProgress({
      status: "running",
      phase: "prepare-input",
      iteration: 0,
      diffRatio: null,
      message: "Preparing input"
    });

    await prepareInput();

    await reportProgress({
      status: "running",
      phase: "generate-initial",
      iteration: 0,
      diffRatio: null,
      message: "Generating initial HTML/CSS"
    });

    await generateInitial(adapter);

    for (let iteration = 1; iteration <= config.maxIterations; iteration += 1) {
      await reportProgress({
        status: "running",
        phase: "render",
        iteration,
        diffRatio: finalDiffRatio,
        message: "Rendering current output"
      });
      latestRenderPath = await renderPage(iteration);

      await reportProgress({
        status: "running",
        phase: "compare",
        iteration,
        diffRatio: finalDiffRatio,
        message: "Comparing render and source"
      });
      const comparison = await compareImages(iteration, latestRenderPath);
      latestDiffPath = comparison.diffPath;
      finalDiffRatio = comparison.metrics.diffRatio;

      await reportProgress({
        status: "running",
        phase: "analyze",
        iteration,
        diffRatio: finalDiffRatio,
        message: "Analyzing diff"
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
      console.log(
        `[METRIC] iter=${iteration} diff=${comparison.metrics.diffRatio.toFixed(4)} improvement=${
          improvementFromPrevious === null ? "n/a" : improvementFromPrevious.toFixed(4)
        }`
      );

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

      await reportProgress({
        status: "running",
        phase: "revise",
        iteration,
        diffRatio: finalDiffRatio,
        message: "Revising HTML/CSS"
      });
      try {
        await reviseCode(adapter, analysis, iteration);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(
          `[WARN] iter=${iteration} phase=revise fallback=keep-previous-code reason="${errorMessage}"`
        );
        await reportProgress({
          status: "running",
          phase: "revise",
          iteration,
          diffRatio: finalDiffRatio,
          message: `Revise failed, fallback to previous HTML/CSS: ${errorMessage}`
        });
      }

      previousDiffRatio = comparison.metrics.diffRatio;
    }

    await reportProgress({
      status: "running",
      phase: "finalize",
      iteration: iterationsCompleted,
      diffRatio: finalDiffRatio,
      message: "Finalizing outputs"
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

    await reportProgress({
      status: "success",
      phase: "done",
      iteration: iterationsCompleted,
      diffRatio: finalDiffRatio,
      message: "Run completed"
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await reportProgress({
      status: "failed",
      phase: "done",
      iteration: iterationsCompleted,
      diffRatio: finalDiffRatio,
      message: errorMessage
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
