export const config = {
  ai: {
    mode: "gemini-cli" as "mock" | "prompt-export" | "gemini-cli",
    gemini: {
      command: "gemini",
      args: ["-m", "flash", "-p"],
      timeoutMs: 120000,
      retryCount: 1
    }
  },
  inputImagePath: "input/design.png",
  outputHtmlPath: "output/index.html",
  outputCssPath: "output/styles.css",
  maxIterations: 5,
  targetDiffRatio: 0.08,
  minimumImprovement: 0.01,
  viewport: {
    width: 1440,
    height: 4000
  },
  prompts: {
    initialGeneration: "prompts/initial-generation.md",
    diffAnalysis: "prompts/diff-analysis.md",
    reviseCode: "prompts/revise-code.md"
  },
  directories: {
    output: "output",
    renders: "renders",
    diff: "diff",
    logs: "logs",
    iterations: "logs/iterations",
    generatedPrompts: "prompts/generated",
    aiLogs: "logs/ai"
  }
};
