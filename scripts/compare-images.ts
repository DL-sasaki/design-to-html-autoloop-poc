import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { config } from "./shared/config.js";
import type { DiffMetrics } from "./shared/types.js";

function toCanvas(source: PNG, width: number, height: number): PNG {
  const canvas = new PNG({ width, height, colorType: 6 });
  const offsetX = Math.floor((width - source.width) / 2);
  const offsetY = Math.floor((height - source.height) / 2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dstX = x + offsetX;
      const dstY = y + offsetY;
      const dstIndex = (dstY * width + dstX) * 4;
      canvas.data[dstIndex] = 255;
      canvas.data[dstIndex + 1] = 255;
      canvas.data[dstIndex + 2] = 255;
      canvas.data[dstIndex + 3] = 255;
    }
  }

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const srcIndex = (y * source.width + x) * 4;
      const dstIndex = (y * width + x) * 4;
      canvas.data[dstIndex] = source.data[srcIndex];
      canvas.data[dstIndex + 1] = source.data[srcIndex + 1];
      canvas.data[dstIndex + 2] = source.data[srcIndex + 2];
      canvas.data[dstIndex + 3] = source.data[srcIndex + 3];
    }
  }

  return canvas;
}

export async function compareImages(iteration: number, renderPath: string): Promise<{
  diffPath: string;
  metrics: DiffMetrics;
}> {
  const [srcBuffer, renderBuffer] = await Promise.all([
    readFile(config.inputImagePath),
    readFile(renderPath)
  ]);

  const src = PNG.sync.read(srcBuffer);
  const rendered = PNG.sync.read(renderBuffer);

  const width = Math.max(src.width, rendered.width);
  const height = Math.max(src.height, rendered.height);

  const srcCanvas = toCanvas(src, width, height);
  const renderCanvas = toCanvas(rendered, width, height);
  const diffPng = new PNG({ width, height, colorType: 6 });

  const differentPixels = pixelmatch(
    srcCanvas.data,
    renderCanvas.data,
    diffPng.data,
    width,
    height,
    { threshold: 0.1 }
  );

  const totalPixels = width * height;
  const diffRatio = totalPixels > 0 ? differentPixels / totalPixels : 1;

  const diffPath = path.join(
    config.directories.diff,
    `iteration-${String(iteration).padStart(2, "0")}-diff.png`
  );

  await writeFile(diffPath, PNG.sync.write(diffPng));

  return {
    diffPath,
    metrics: {
      totalPixels,
      differentPixels,
      diffRatio,
      width,
      height
    }
  };
}
