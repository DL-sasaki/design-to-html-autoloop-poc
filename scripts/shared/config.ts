import { existsSync, readFileSync } from "node:fs";

type RuntimeConfig = {
  ai?: {
    mode?: "mock" | "prompt-export" | "gemini-cli";
    gemini?: {
      command?: string;
      args?: string[];
      timeoutMs?: number;
      retryCount?: number;
    };
  };
  inputImagePath?: string;
  outputHtmlPath?: string;
  outputCssPath?: string;
  maxIterations?: number;
  targetDiffRatio?: number;
  minimumImprovement?: number;
  viewport?: {
    width?: number;
    height?: number;
  };
  prompts?: {
    initialGeneration?: string;
    diffAnalysis?: string;
    reviseCode?: string;
  };
  reference?: {
    mode?: "url" | "local";
    url?: {
      enabled?: boolean;
      pageUrl?: string;
      extraCssUrls?: string[];
    };
    local?: {
      htmlPath?: string;
      cssPath?: string;
    };
    rules?: {
      jsonPath?: string;
      guidelinePath?: string;
      regenerateOnRun?: boolean;
      overwrite?: boolean;
    };
  };
  directories?: {
    output?: string;
    renders?: string;
    diff?: string;
    logs?: string;
    iterations?: string;
    generatedPrompts?: string;
    aiLogs?: string;
  };
};

const defaultConfig = {
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
  reference: {
    mode: "local" as "url" | "local",
    url: {
      enabled: true,
      pageUrl: "https://example.com",
      extraCssUrls: [] as string[]
    },
    local: {
      htmlPath: "input/reference.html",
      cssPath: "input/reference.css"
    },
    rules: {
      jsonPath: "design-rules.json",
      guidelinePath: "design-guideline.md",
      regenerateOnRun: false,
      overwrite: false
    }
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

function loadRuntimeConfig(): RuntimeConfig {
  const filePath = "input/runtime-config.json";
  if (!existsSync(filePath)) {
    return {};
  }

  const raw = readFileSync(filePath, "utf8");
  const withoutComments = stripJsonComments(raw);
  try {
    const parsed = JSON.parse(withoutComments) as RuntimeConfig;
    return parsed ?? {};
  } catch {
    throw new Error(`Invalid JSON format: ${filePath}`);
  }
}

function stripJsonComments(input: string): string {
  let out = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escape = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = i + 1 < input.length ? input[i + 1] : "";

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        out += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    out += ch;
  }

  return out;
}

function withOverride<T>(base: T, override: T | undefined): T {
  return override === undefined ? base : override;
}

const runtime = loadRuntimeConfig();

export const config = {
  ai: {
    mode: withOverride(defaultConfig.ai.mode, runtime.ai?.mode),
    gemini: {
      command: withOverride(defaultConfig.ai.gemini.command, runtime.ai?.gemini?.command),
      args: withOverride(defaultConfig.ai.gemini.args, runtime.ai?.gemini?.args),
      timeoutMs: withOverride(defaultConfig.ai.gemini.timeoutMs, runtime.ai?.gemini?.timeoutMs),
      retryCount: withOverride(defaultConfig.ai.gemini.retryCount, runtime.ai?.gemini?.retryCount)
    }
  },
  inputImagePath: withOverride(defaultConfig.inputImagePath, runtime.inputImagePath),
  outputHtmlPath: withOverride(defaultConfig.outputHtmlPath, runtime.outputHtmlPath),
  outputCssPath: withOverride(defaultConfig.outputCssPath, runtime.outputCssPath),
  maxIterations: withOverride(defaultConfig.maxIterations, runtime.maxIterations),
  targetDiffRatio: withOverride(defaultConfig.targetDiffRatio, runtime.targetDiffRatio),
  minimumImprovement: withOverride(defaultConfig.minimumImprovement, runtime.minimumImprovement),
  viewport: {
    width: withOverride(defaultConfig.viewport.width, runtime.viewport?.width),
    height: withOverride(defaultConfig.viewport.height, runtime.viewport?.height)
  },
  prompts: {
    initialGeneration: withOverride(
      defaultConfig.prompts.initialGeneration,
      runtime.prompts?.initialGeneration
    ),
    diffAnalysis: withOverride(defaultConfig.prompts.diffAnalysis, runtime.prompts?.diffAnalysis),
    reviseCode: withOverride(defaultConfig.prompts.reviseCode, runtime.prompts?.reviseCode)
  },
  reference: {
    mode: withOverride(defaultConfig.reference.mode, runtime.reference?.mode),
    url: {
      enabled: withOverride(defaultConfig.reference.url.enabled, runtime.reference?.url?.enabled),
      pageUrl: withOverride(defaultConfig.reference.url.pageUrl, runtime.reference?.url?.pageUrl),
      extraCssUrls: withOverride(
        defaultConfig.reference.url.extraCssUrls,
        runtime.reference?.url?.extraCssUrls
      )
    },
    local: {
      htmlPath: withOverride(
        defaultConfig.reference.local.htmlPath,
        runtime.reference?.local?.htmlPath
      ),
      cssPath: withOverride(defaultConfig.reference.local.cssPath, runtime.reference?.local?.cssPath)
    },
    rules: {
      jsonPath: withOverride(
        defaultConfig.reference.rules.jsonPath,
        runtime.reference?.rules?.jsonPath
      ),
      guidelinePath: withOverride(
        defaultConfig.reference.rules.guidelinePath,
        runtime.reference?.rules?.guidelinePath
      ),
      regenerateOnRun: withOverride(
        defaultConfig.reference.rules.regenerateOnRun,
        runtime.reference?.rules?.regenerateOnRun
      ),
      overwrite: withOverride(defaultConfig.reference.rules.overwrite, runtime.reference?.rules?.overwrite)
    }
  },
  directories: {
    output: withOverride(defaultConfig.directories.output, runtime.directories?.output),
    renders: withOverride(defaultConfig.directories.renders, runtime.directories?.renders),
    diff: withOverride(defaultConfig.directories.diff, runtime.directories?.diff),
    logs: withOverride(defaultConfig.directories.logs, runtime.directories?.logs),
    iterations: withOverride(defaultConfig.directories.iterations, runtime.directories?.iterations),
    generatedPrompts: withOverride(
      defaultConfig.directories.generatedPrompts,
      runtime.directories?.generatedPrompts
    ),
    aiLogs: withOverride(defaultConfig.directories.aiLogs, runtime.directories?.aiLogs)
  }
};
