import path from "node:path";
import { config } from "./config.js";
import type { IterationLog, LatestStatus, RunSummary } from "./types.js";
import { writeJson } from "./file-utils.js";

const latestStatusPath = path.join(config.directories.logs, "latest-status.json");
const runSummaryPath = path.join(config.directories.logs, "run-summary.json");

export async function writeLatestStatus(status: LatestStatus): Promise<void> {
  await writeJson(latestStatusPath, status);
}

export async function writeIterationLog(log: IterationLog): Promise<void> {
  const fileName = `iteration-${String(log.iteration).padStart(2, "0")}.json`;
  const filePath = path.join(config.directories.iterations, fileName);
  await writeJson(filePath, log);
}

export async function writeRunSummary(summary: RunSummary): Promise<void> {
  await writeJson(runSummaryPath, summary);
}
