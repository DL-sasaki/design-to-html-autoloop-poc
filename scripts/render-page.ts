import path from "node:path";
import { chromium } from "playwright";
import { config } from "./shared/config.js";

export async function renderPage(iteration: number): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: config.viewport });
    const absoluteHtml = path.resolve(config.outputHtmlPath);
    await page.goto(`file://${absoluteHtml}`, { waitUntil: "networkidle" });
    const renderPath = path.join(
      config.directories.renders,
      `iteration-${String(iteration).padStart(2, "0")}.png`
    );
    await page.screenshot({ path: renderPath, fullPage: true });
    return renderPath;
  } finally {
    await browser.close();
  }
}
