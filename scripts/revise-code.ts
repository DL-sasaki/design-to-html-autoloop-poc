import { config } from "./shared/config.js";
import { readText, writeText } from "./shared/file-utils.js";
import type { AiAdapter } from "./shared/ai-adapter.js";
import type { DiffAnalysis } from "./shared/types.js";

export async function reviseCode(
  adapter: AiAdapter,
  analysis: DiffAnalysis,
  iteration: number
): Promise<void> {
  const [html, css] = await Promise.all([
    readText(config.outputHtmlPath),
    readText(config.outputCssPath)
  ]);

  const revised = await adapter.reviseCode({
    iteration,
    html,
    css,
    analysis,
    promptPath: config.prompts.reviseCode
  });

  await Promise.all([
    writeText(config.outputHtmlPath, revised.html),
    writeText(config.outputCssPath, revised.css)
  ]);
}
