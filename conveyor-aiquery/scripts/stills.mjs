// Usage: node scripts/stills.mjs <compId> <outPrefix> <frame,frame,...> [scale]
// Bundles once, opens one browser, renders the listed frames as PNG and
// prints the per-frame render time.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync } from "node:fs";
import path from "node:path";

const [id, prefix, framesArg, scaleArg] = process.argv.slice(2);
const frames = framesArg.split(",").map(Number);
const scale = scaleArg ? Number(scaleArg) : 1 / 3;
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(pw) ? pw : null;
const chromiumOptions = { gl: "angle" };

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, chromiumOptions, browserExecutable });
for (const frame of frames) {
  const t0 = performance.now();
  await renderStill({ composition, serveUrl, frame, output: `${prefix}_${String(frame).padStart(3, "0")}.png`, scale, puppeteerInstance: browser, chromiumOptions, browserExecutable, imageFormat: "png", timeoutInMilliseconds: 600000 });
  console.log(`frame ${frame}: ${((performance.now() - t0) / 1000).toFixed(2)} s`);
}
await browser.close({ silent: true });
