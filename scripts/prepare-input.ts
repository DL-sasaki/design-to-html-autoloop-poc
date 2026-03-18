import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { config } from "./shared/config.js";
import { ensureDir } from "./shared/file-utils.js";

export async function prepareInput(): Promise<void> {
  const imagePath = config.inputImagePath;

  const fileStat = await stat(imagePath).catch(() => null);
  if (!fileStat) {
    throw new Error("Input file does not exist: input/design.png");
  }

  if (!imagePath.toLowerCase().endsWith(".png")) {
    throw new Error("Input file must be PNG");
  }

  if (fileStat.size <= 0) {
    throw new Error("Input file is empty");
  }

  const buffer = await readFile(imagePath);
  try {
    PNG.sync.read(buffer);
  } catch {
    throw new Error("Input PNG cannot be decoded");
  }

  await Promise.all([
    ensureDir(path.dirname(config.outputHtmlPath)),
    ensureDir(path.dirname(config.outputCssPath)),
    ensureDir(config.directories.renders),
    ensureDir(config.directories.diff),
    ensureDir(config.directories.logs),
    ensureDir(config.directories.iterations),
    ensureDir(config.directories.generatedPrompts),
    ensureDir(config.directories.aiLogs),
    ensureDir(path.dirname(config.reference.rules.jsonPath)),
    ensureDir(path.dirname(config.reference.rules.guidelinePath))
  ]);
}
