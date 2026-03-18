import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { config } from "./config.js";
import { ensureDir, readText, writeText } from "./file-utils.js";
import type { DiffAnalysis, DiffMetrics } from "./types.js";

export interface AiAdapter {
  generateInitial(input: {
    imagePath: string;
    promptPath: string;
  }): Promise<{ html: string; css: string }>;

  analyzeDiff(input: {
    imagePath: string;
    renderPath: string;
    diffPath: string;
    metrics: DiffMetrics;
    promptPath: string;
  }): Promise<DiffAnalysis>;

  reviseCode(input: {
    iteration: number;
    html: string;
    css: string;
    analysis: DiffAnalysis;
    promptPath: string;
  }): Promise<{ html: string; css: string }>;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstObjectStart = trimmed.indexOf("{");
  if (firstObjectStart >= 0) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = firstObjectStart; i < trimmed.length; i += 1) {
      const ch = trimmed[i];

      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === "\"") {
          inString = false;
        }
        continue;
      }

      if (ch === "\"") {
        inString = true;
        continue;
      }

      if (ch === "{") {
        depth += 1;
        continue;
      }

      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return trimmed.slice(firstObjectStart, i + 1);
        }
      }
    }
  }

  throw new Error("No JSON object found in AI response");
}

function normalizeJsonText(text: string): string {
  let normalized = text.trim().replace(/^\uFEFF/, "");
  normalized = normalized.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  normalized = normalized.replace(/\}\s*"+\s*$/, "}");
  return normalized;
}

function fallbackExtractJsonObject(text: string): string {
  const normalized = normalizeJsonText(text);
  const first = normalized.indexOf("{");
  const last = normalized.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return normalized.slice(first, last + 1);
  }
  throw new Error("No JSON object found in AI response");
}

function decodeEscapedString(value: string): string {
  return value
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function salvageHtmlCss(raw: string): { html: string; css: string } {
  const normalized = normalizeJsonText(raw);
  const match = normalized.match(
    /"html"\s*:\s*"([\s\S]*?)"\s*,\s*"css"\s*:\s*"([\s\S]*?)"\s*}\s*$/
  );
  if (!match) {
    throw new Error("Failed to salvage html/css from malformed JSON");
  }

  return {
    html: decodeEscapedString(match[1]),
    css: decodeEscapedString(match[2])
  };
}

function parseHtmlCssResponse(raw: string): { html: string; css: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(normalizeJsonText(raw)));
  } catch {
    try {
      parsed = JSON.parse(fallbackExtractJsonObject(raw));
    } catch {
      return salvageHtmlCss(raw);
    }
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { html?: unknown }).html !== "string" ||
    typeof (parsed as { css?: unknown }).css !== "string"
  ) {
    throw new Error("AI response JSON must include string html and css");
  }

  return {
    html: (parsed as { html: string }).html,
    css: (parsed as { css: string }).css
  };
}

function parseDiffAnalysisResponse(raw: string): DiffAnalysis {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(normalizeJsonText(raw)));
  } catch {
    try {
      parsed = JSON.parse(fallbackExtractJsonObject(raw));
    } catch {
      throw new Error("AI diff analysis JSON is invalid");
    }
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { summary?: unknown }).summary !== "string" ||
    !Array.isArray((parsed as { issues?: unknown }).issues)
  ) {
    throw new Error("AI diff analysis JSON must include summary and issues[]");
  }

  return parsed as DiffAnalysis;
}

async function runGemini(prompts: string[], logStem: string): Promise<string> {
  await ensureDir(config.directories.aiLogs);

  const cmd = config.ai.gemini.command;

  let attempt = 0;
  const maxAttempts = Math.max(1, config.ai.gemini.retryCount + 1);
  let lastError: string | null = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    const prompt = prompts[Math.min(attempt - 1, prompts.length - 1)];
    const reqPath = path.join(config.directories.aiLogs, `${logStem}-attempt-${attempt}-request.txt`);
    const resPath = path.join(config.directories.aiLogs, `${logStem}-attempt-${attempt}-response.txt`);
    await writeText(reqPath, `${prompt}\n`);

    const args = [...config.ai.gemini.args, prompt];
    try {
      const output = await new Promise<string>((resolve, reject) => {
        const child = spawn(cmd, args, {
          stdio: ["ignore", "pipe", "pipe"],
          shell: false
        });

        let stdout = "";
        let stderr = "";
        let timedOut = false;

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, config.ai.gemini.timeoutMs);

        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });

        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });

        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });

        child.on("close", (code) => {
          clearTimeout(timer);
          if (timedOut) {
            reject(new Error(`gemini command timeout after ${config.ai.gemini.timeoutMs}ms`));
            return;
          }
          if (code !== 0) {
            reject(new Error(`gemini command failed (code=${code}): ${stderr || "no stderr"}`));
            return;
          }
          resolve(stdout || stderr);
        });
      });

      await writeText(resPath, `${output}\n`);
      return output;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt >= maxAttempts) {
        break;
      }
    }
  }

  throw new Error(lastError ?? "gemini command failed");
}

async function parseHtmlCssWithRepair(raw: string, logStem: string): Promise<{ html: string; css: string }> {
  try {
    return parseHtmlCssResponse(raw);
  } catch {
    const repairPrompt = [
      "Repair the following malformed JSON into strict valid JSON.",
      "Rules:",
      "1) Output ONLY a single JSON object.",
      "2) Keep content meaning unchanged.",
      "3) Required keys: html, css (both strings).",
      "4) Escape all quotes/newlines correctly.",
      'Format: {"html":"...","css":"..."}',
      "",
      "Malformed input:",
      raw
    ].join("\n");

    const repaired = await runGemini([repairPrompt], `${logStem}-repair`);
    return parseHtmlCssResponse(repaired);
  }
}

async function parseDiffAnalysisWithRepair(raw: string, logStem: string): Promise<DiffAnalysis> {
  try {
    return parseDiffAnalysisResponse(raw);
  } catch {
    const repairPrompt = [
      "Repair the following malformed JSON into strict valid JSON.",
      "Rules:",
      "1) Output ONLY a single JSON object.",
      "2) Required keys: summary(string), issues(array).",
      "3) Each issue must include: category, severity, description, suggestedAction.",
      "",
      "Malformed input:",
      raw
    ].join("\n");

    const repaired = await runGemini([repairPrompt], `${logStem}-repair`);
    return parseDiffAnalysisResponse(repaired);
  }
}

export class MockAiAdapter implements AiAdapter {
  async generateInitial(input: {
    imagePath: string;
    promptPath: string;
  }): Promise<{ html: string; css: string }> {
    await readText(input.promptPath);
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated Landing Page</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <p class="eyebrow">AUTOGENERATED</p>
        <h1>Landing Page Draft</h1>
        <p class="lead">Replace this structure iteratively based on visual diff analysis.</p>
        <a href="#" class="cta">Call to Action</a>
      </section>
    </main>
  </body>
</html>
`;
    const css = `:root {
  --bg: #f6f7fb;
  --text: #1c2230;
  --muted: #616b7e;
  --accent: #2962ff;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  background: var(--bg);
}

.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 56px 24px;
}

.hero {
  max-width: 900px;
  text-align: center;
  background: #fff;
  border-radius: 16px;
  padding: 72px 56px;
  box-shadow: 0 20px 40px rgba(17, 24, 39, 0.08);
}

.eyebrow {
  letter-spacing: 0.12em;
  font-size: 12px;
  color: var(--muted);
  margin: 0 0 12px;
}

h1 {
  margin: 0;
  font-size: 48px;
  line-height: 1.1;
}

.lead {
  margin: 20px auto 0;
  max-width: 56ch;
  line-height: 1.7;
  color: var(--muted);
}

.cta {
  margin-top: 28px;
  display: inline-block;
  padding: 12px 22px;
  border-radius: 10px;
  text-decoration: none;
  color: #fff;
  background: var(--accent);
  font-weight: 600;
}
`;
    return { html, css };
  }

  async analyzeDiff(input: {
    imagePath: string;
    renderPath: string;
    diffPath: string;
    metrics: DiffMetrics;
    promptPath: string;
  }): Promise<DiffAnalysis> {
    await readText(input.promptPath);
    const severity: "low" | "medium" | "high" =
      input.metrics.diffRatio > 0.2 ? "high" : input.metrics.diffRatio > 0.1 ? "medium" : "low";

    return {
      summary: `Visual diff ratio is ${input.metrics.diffRatio.toFixed(4)}.`,
      issues: [
        {
          category: "layout-proportion",
          severity,
          description: "Overall proportions do not match the source design.",
          suggestedAction: "Adjust section dimensions and spacing scale."
        },
        {
          category: "alignment",
          severity,
          description: "Primary content alignment differs from source.",
          suggestedAction: "Tune container width and horizontal alignment."
        },
        {
          category: "color",
          severity,
          description: "Detected color mismatch in major surfaces.",
          suggestedAction: "Refine background and text color values."
        }
      ]
    };
  }

  async reviseCode(input: {
    iteration: number;
    html: string;
    css: string;
    analysis: DiffAnalysis;
    promptPath: string;
  }): Promise<{ html: string; css: string }> {
    await readText(input.promptPath);
    const highIssueCount = input.analysis.issues.filter((issue) => issue.severity === "high").length;

    let nextCss = input.css;
    if (highIssueCount > 0 && !input.css.includes("--iteration-tweak")) {
      nextCss += `\n:root {\n  --iteration-tweak: 1;\n}\n`;
    }

    return { html: input.html, css: nextCss };
  }
}

class PromptExportAdapter extends MockAiAdapter {
  override async reviseCode(input: {
    iteration: number;
    html: string;
    css: string;
    analysis: DiffAnalysis;
    promptPath: string;
  }): Promise<{ html: string; css: string }> {
    const promptInstruction = await readText(input.promptPath);
    await ensureDir(config.directories.generatedPrompts);

    const baseName = `iteration-${String(input.iteration).padStart(2, "0")}-revise`;
    const requestPath = path.join(config.directories.generatedPrompts, `${baseName}-request.md`);
    const responsePath = path.join(config.directories.generatedPrompts, `${baseName}-response.json`);
    const samplePath = path.join(config.directories.generatedPrompts, `${baseName}-response.sample.json`);

    const requestText = [
      "# Revise Request",
      "",
      "## Instruction",
      promptInstruction.trim(),
      "",
      "## Expected Output Format",
      "Return JSON only:",
      '{ "html": "<full updated html>", "css": "<full updated css>" }',
      "",
      "## Diff Analysis",
      "```json",
      JSON.stringify(input.analysis, null, 2),
      "```",
      "",
      "## Current HTML",
      "```html",
      input.html,
      "```",
      "",
      "## Current CSS",
      "```css",
      input.css,
      "```",
      "",
      "## Response File Path",
      responsePath
    ].join("\n");

    await Promise.all([
      writeText(requestPath, `${requestText}\n`),
      writeText(
        samplePath,
        `${JSON.stringify({ html: "<full updated html>", css: "<full updated css>" }, null, 2)}\n`
      )
    ]);

    const responseExists = await access(responsePath)
      .then(() => true)
      .catch(() => false);

    if (!responseExists) {
      throw new Error(
        `AI response JSON is missing: ${responsePath}. Fill this file with {"html":"...","css":"..."} and rerun.`
      );
    }

    const raw = await readText(responsePath);
    return parseHtmlCssResponse(raw);
  }
}

class GeminiCliAdapter implements AiAdapter {
  async generateInitial(input: {
    imagePath: string;
    promptPath: string;
  }): Promise<{ html: string; css: string }> {
    const instruction = await readText(input.promptPath);

    const prompt = [
      instruction.trim(),
      "",
      `Source design image path: ${input.imagePath}`,
      "Analyze the image and generate initial page code.",
      "Return ONLY valid JSON:",
      '{"html":"<full updated html>","css":"<full updated css>"}'
    ].join("\n");

    const strictPrompt = [
      instruction.trim(),
      "",
      `Source design image path: ${input.imagePath}`,
      "Analyze the image and generate initial page code.",
      "Output format rules:",
      "1) Output ONLY a single JSON object.",
      "2) Do not include markdown fences.",
      "3) Do not include explanation text.",
      "4) Use double quotes for all keys and string values.",
      '{"html":"<full updated html>","css":"<full updated css>"}'
    ].join("\n");

    const logStem = "initial-generation";
    const raw = await runGemini([prompt, strictPrompt], logStem);
    return parseHtmlCssWithRepair(raw, logStem);
  }

  async analyzeDiff(input: {
    imagePath: string;
    renderPath: string;
    diffPath: string;
    metrics: DiffMetrics;
    promptPath: string;
  }): Promise<DiffAnalysis> {
    const instruction = await readText(input.promptPath);

    const prompt = [
      instruction.trim(),
      "",
      `Source image path: ${input.imagePath}`,
      `Render image path: ${input.renderPath}`,
      `Diff image path: ${input.diffPath}`,
      "Metrics:",
      JSON.stringify(input.metrics, null, 2),
      "",
      "Return ONLY valid JSON:",
      `{
  "summary": "...",
  "issues": [
    {
      "category": "missing-element|spacing|font-size|alignment|color|layout-proportion|unknown",
      "severity": "low|medium|high",
      "description": "...",
      "suggestedAction": "..."
    }
  ]
}`
    ].join("\n");

    const strictPrompt = [
      instruction.trim(),
      "",
      `Source image path: ${input.imagePath}`,
      `Render image path: ${input.renderPath}`,
      `Diff image path: ${input.diffPath}`,
      "Metrics:",
      JSON.stringify(input.metrics, null, 2),
      "",
      "Output format rules:",
      "1) Output ONLY a single JSON object.",
      "2) Do not include markdown fences.",
      "3) Do not include explanation text.",
      "4) Use double quotes for all keys and string values.",
      `{
  "summary": "...",
  "issues": [
    {
      "category": "missing-element|spacing|font-size|alignment|color|layout-proportion|unknown",
      "severity": "low|medium|high",
      "description": "...",
      "suggestedAction": "..."
    }
  ]
}`
    ].join("\n");

    const logStem = `analysis-${Date.now()}`;
    const raw = await runGemini([prompt, strictPrompt], logStem);
    return parseDiffAnalysisWithRepair(raw, logStem);
  }

  async reviseCode(input: {
    iteration: number;
    html: string;
    css: string;
    analysis: DiffAnalysis;
    promptPath: string;
  }): Promise<{ html: string; css: string }> {
    const instruction = await readText(input.promptPath);

    const prompt = [
      instruction.trim(),
      "",
      "Diff analysis:",
      JSON.stringify(input.analysis, null, 2),
      "",
      "Current HTML:",
      "```html",
      input.html,
      "```",
      "",
      "Current CSS:",
      "```css",
      input.css,
      "```",
      "",
      "Return ONLY valid JSON:",
      '{"html":"<full updated html>","css":"<full updated css>"}'
    ].join("\n");

    const strictPrompt = [
      instruction.trim(),
      "",
      "Diff analysis:",
      JSON.stringify(input.analysis, null, 2),
      "",
      "Current HTML:",
      "```html",
      input.html,
      "```",
      "",
      "Current CSS:",
      "```css",
      input.css,
      "```",
      "",
      "Output format rules:",
      "1) Output ONLY a single JSON object.",
      "2) Do not include markdown fences.",
      "3) Do not include explanation text.",
      "4) Use double quotes for all keys and string values.",
      '{"html":"<full updated html>","css":"<full updated css>"}'
    ].join("\n");

    const logStem = `revise-${String(input.iteration).padStart(2, "0")}`;
    const raw = await runGemini(
      [prompt, strictPrompt],
      logStem
    );
    return parseHtmlCssWithRepair(raw, logStem);
  }
}

export function createAiAdapter(): AiAdapter {
  if (config.ai.mode === "gemini-cli") {
    return new GeminiCliAdapter();
  }
  if (config.ai.mode === "prompt-export") {
    return new PromptExportAdapter();
  }
  return new MockAiAdapter();
}
