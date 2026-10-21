// Render individual frames as PNG stills, reusing one browser.
// Usage: node scripts/stills.mjs <compositionId> <outDir> <frame,frame,...> [scale]
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [compId, outDir, framesArg, scaleArg] = process.argv.slice(2);
const frames = framesArg.split(",").map(Number);
const scale = scaleArg ? Number(scaleArg) : 1 / 3;
mkdirSync(outDir, { recursive: true });

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const chromiumOptions = { gl: "angle" };

const serveUrl = process.env.BUNDLE ?? (await bundle({ entryPoint: path.resolve("src/index.ts") }));
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
const composition = await selectComposition({ serveUrl, id: compId, puppeteerInstance: browser, chromiumOptions, browserExecutable });
for (const frame of frames) {
  const t0 = performance.now();
  await renderStill({
    serveUrl,
    composition,
    frame,
    output: path.join(outDir, `${compId}_${String(frame).padStart(4, "0")}.png`),
    imageFormat: "png",
    scale,
    puppeteerInstance: browser,
    chromiumOptions,
    browserExecutable,
    overwrite: true,
  });
  console.log(`frame ${frame}: ${(performance.now() - t0).toFixed(0)} ms`);
}
await browser.close({ silent: true });
