// Render selected frames of compositions to PNG with one shared browser.
// Usage: node scripts/frames.mjs <outDir> <scale> <frame,frame,...> <compId> [compId...]
// Example: node scripts/frames.mjs /tmp/f 0.3333333333333333 420 FlagMarket-USA-Up
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const [outDir, scaleArg, framesArg, ...ids] = process.argv.slice(2);
if (!outDir || !ids.length) {
  console.error("usage: node scripts/frames.mjs <outDir> <scale> <frames> <compId...>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome", { browserExecutable });
const frames = framesArg.split(",").map(Number);
let failed = 0;
for (const id of ids) {
  try {
    const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser });
    for (const frame of frames) {
      const t0 = performance.now();
      await renderStill({
        serveUrl,
        composition,
        frame,
        scale: Number(scaleArg),
        output: path.join(outDir, `${id}-${frame}.png`),
        puppeteerInstance: browser,
        overwrite: true,
      });
      console.log(`${id} frame ${frame}: ok (${(performance.now() - t0).toFixed(0)} ms)`);
    }
  } catch (e) {
    failed++;
    console.error(`${id}: FAILED`, e);
  }
}
await browser.close({ silent: true });
process.exit(failed ? 1 : 0);
