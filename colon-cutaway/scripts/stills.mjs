// Render a list of frames of one composition to PNG with one bundle + browser.
// usage: node scripts/stills.mjs <compId> <outDir> <scale> <frame,frame,...> [--props '{..}']
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [, , compId, outDir, scaleArg, framesArg] = process.argv;
const propsIdx = process.argv.indexOf("--props");
const inputProps = propsIdx > 0 ? JSON.parse(process.argv[propsIdx + 1]) : {};
const scale = Number(scaleArg);
const frames = framesArg.split(",").map(Number);
mkdirSync(outDir, { recursive: true });
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(exe) ? exe : null;
const chromiumOptions = { gl: "angle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
const composition = await selectComposition({ serveUrl, id: compId, inputProps, puppeteerInstance: browser, browserExecutable, chromiumOptions });
for (const frame of frames) {
  const t0 = Date.now();
  await renderStill({
    composition,
    serveUrl,
    output: path.join(outDir, `${compId}_${String(frame).padStart(4, "0")}.png`),
    frame,
    scale,
    inputProps,
    puppeteerInstance: browser,
    browserExecutable,
    chromiumOptions,
    imageFormat: "png",
    overwrite: true,
  });
  console.log(`frame ${frame}: ${Date.now() - t0} ms`);
}
await browser.close({ silent: true });
