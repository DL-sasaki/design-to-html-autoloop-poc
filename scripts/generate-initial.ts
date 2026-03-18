import { config } from "./shared/config.js";
import { writeText } from "./shared/file-utils.js";
import type { AiAdapter } from "./shared/ai-adapter.js";

export async function generateInitial(adapter: AiAdapter): Promise<void> {
  const generated = await adapter.generateInitial({
    imagePath: config.inputImagePath,
    promptPath: config.prompts.initialGeneration
  });

  await Promise.all([
    writeText(config.outputHtmlPath, generated.html),
    writeText(config.outputCssPath, generated.css)
  ]);
}
