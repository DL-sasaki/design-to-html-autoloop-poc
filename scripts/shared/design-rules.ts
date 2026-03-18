import { access } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { readText, writeJson, writeText } from "./file-utils.js";

type DesignRules = {
  source: {
    mode: "url" | "local";
    pageUrl?: string;
    htmlPath?: string;
    cssPath?: string;
  };
  tokens: {
    colors: string[];
    fontFamilies: string[];
    fontSizes: string[];
    spacing: string[];
    radius: string[];
    shadows: string[];
  };
  constraints: {
    sectionOnly: boolean;
    compareAlignment: "center";
    outputFiles: string[];
  };
};

async function exists(filePath: string): Promise<boolean> {
  return access(filePath)
    .then(() => true)
    .catch(() => false);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort();
}

function pickTop(values: string[], max = 24): string[] {
  return values.slice(0, max);
}

function extractMatches(text: string, pattern: RegExp): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(pattern)) {
    if (match[1]) {
      out.push(match[1]);
    }
  }
  return out;
}

function extractRulesFromCss(css: string): Omit<DesignRules["tokens"], never> {
  const colors = [
    ...extractMatches(css, /(#[0-9a-fA-F]{3,8})/g),
    ...extractMatches(css, /\b(rgba?\([^\)]+\))/g),
    ...extractMatches(css, /\b(hsla?\([^\)]+\))/g)
  ];

  const fontFamilies = extractMatches(css, /font-family\s*:\s*([^;]+);/g);
  const fontSizes = extractMatches(css, /font-size\s*:\s*([^;]+);/g);
  const spacing = [
    ...extractMatches(css, /(?:margin|padding|gap)\s*:\s*([^;]+);/g),
    ...extractMatches(css, /(?:margin|padding|gap)-(?:top|right|bottom|left)\s*:\s*([^;]+);/g)
  ];
  const radius = extractMatches(css, /border-radius\s*:\s*([^;]+);/g);
  const shadows = extractMatches(css, /box-shadow\s*:\s*([^;]+);/g);

  return {
    colors: pickTop(uniqueSorted(colors), 32),
    fontFamilies: pickTop(uniqueSorted(fontFamilies), 16),
    fontSizes: pickTop(uniqueSorted(fontSizes), 24),
    spacing: pickTop(uniqueSorted(spacing), 32),
    radius: pickTop(uniqueSorted(radius), 16),
    shadows: pickTop(uniqueSorted(shadows), 16)
  };
}

function toAbsoluteUrl(baseUrl: string, maybeRelative: string): string {
  return new URL(maybeRelative, baseUrl).toString();
}

function extractCssLinksFromHtml(html: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    if (match[1]) {
      links.push(match[1]);
    }
  }
  return links;
}

async function loadFromUrl(): Promise<{ html: string; css: string; source: DesignRules["source"] }> {
  const pageUrl = config.reference.url.pageUrl;
  const htmlResponse = await fetch(pageUrl);
  if (!htmlResponse.ok) {
    throw new Error(`Failed to fetch reference URL: ${pageUrl}`);
  }
  const html = await htmlResponse.text();

  const cssUrls = [
    ...extractCssLinksFromHtml(html).map((href) => toAbsoluteUrl(pageUrl, href)),
    ...config.reference.url.extraCssUrls
  ];

  const cssChunks: string[] = [];
  for (const cssUrl of uniqueSorted(cssUrls)) {
    const cssResponse = await fetch(cssUrl);
    if (cssResponse.ok) {
      cssChunks.push(await cssResponse.text());
    }
  }

  return {
    html,
    css: cssChunks.join("\n\n"),
    source: {
      mode: "url",
      pageUrl
    }
  };
}

async function loadFromLocal(): Promise<{ html: string; css: string; source: DesignRules["source"] }> {
  const htmlPath = config.reference.local.htmlPath;
  const cssPath = config.reference.local.cssPath;

  const [html, css] = await Promise.all([readText(htmlPath), readText(cssPath)]);

  return {
    html,
    css,
    source: {
      mode: "local",
      htmlPath,
      cssPath
    }
  };
}

function buildGuideline(rules: DesignRules): string {
  const lines: string[] = [];
  lines.push("# Design Guideline");
  lines.push("");
  lines.push("## Scope");
  lines.push("- Generate a single web section only.");
  lines.push("- Keep output in `output/index.html` and `output/styles.css`.");
  lines.push("- Prefer center-aligned section composition for visual comparison.");
  lines.push("");
  lines.push("## Source");
  if (rules.source.mode === "url") {
    lines.push(`- Mode: url`);
    lines.push(`- URL: ${rules.source.pageUrl}`);
  } else {
    lines.push(`- Mode: local`);
    lines.push(`- HTML: ${rules.source.htmlPath}`);
    lines.push(`- CSS: ${rules.source.cssPath}`);
  }
  lines.push("");
  lines.push("## Tokens");

  const appendTokenSection = (title: string, values: string[]) => {
    lines.push(`### ${title}`);
    if (values.length === 0) {
      lines.push("- (none)");
    } else {
      for (const value of values) {
        lines.push(`- ${value}`);
      }
    }
    lines.push("");
  };

  appendTokenSection("Colors", rules.tokens.colors);
  appendTokenSection("Font Families", rules.tokens.fontFamilies);
  appendTokenSection("Font Sizes", rules.tokens.fontSizes);
  appendTokenSection("Spacing", rules.tokens.spacing);
  appendTokenSection("Border Radius", rules.tokens.radius);
  appendTokenSection("Shadows", rules.tokens.shadows);

  lines.push("## Generation Rules");
  lines.push("- Reuse listed tokens before introducing new values.");
  lines.push("- Preserve section hierarchy and avoid unnecessary extra wrappers.");
  lines.push("- Keep CTA, heading, and supporting text as primary visual anchors.");
  lines.push("- Avoid full-page recreation; output only one section.");

  return `${lines.join("\n")}\n`;
}

export async function ensureDesignRules(): Promise<void> {
  const jsonPath = config.reference.rules.jsonPath;
  const guidelinePath = config.reference.rules.guidelinePath;

  if (!config.reference.rules.regenerateOnRun) {
    return;
  }

  if (config.reference.mode === "url" && !config.reference.url.enabled) {
    return;
  }

  if (!config.reference.rules.overwrite) {
    const [jsonExists, guidelineExists] = await Promise.all([exists(jsonPath), exists(guidelinePath)]);
    if (jsonExists && guidelineExists) {
      return;
    }
  }

  const sourcePayload =
    config.reference.mode === "url" ? await loadFromUrl() : await loadFromLocal();

  const tokens = extractRulesFromCss(sourcePayload.css);

  const rules: DesignRules = {
    source: sourcePayload.source,
    tokens,
    constraints: {
      sectionOnly: true,
      compareAlignment: "center",
      outputFiles: [config.outputHtmlPath, config.outputCssPath]
    }
  };

  const guideline = buildGuideline(rules);

  await Promise.all([writeJson(jsonPath, rules), writeText(guidelinePath, guideline)]);
}

export async function loadGuidelineText(): Promise<string> {
  const guidelinePath = config.reference.rules.guidelinePath;
  if (!(await exists(guidelinePath))) {
    return "";
  }
  return readText(guidelinePath);
}

export function getRulesFilePaths(): { jsonPath: string; guidelinePath: string } {
  return {
    jsonPath: path.resolve(config.reference.rules.jsonPath),
    guidelinePath: path.resolve(config.reference.rules.guidelinePath)
  };
}
