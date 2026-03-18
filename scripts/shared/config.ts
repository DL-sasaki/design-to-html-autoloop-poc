export const config = {
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
    iterations: "logs/iterations"
  }
};
