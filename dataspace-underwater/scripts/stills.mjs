// Render specific frames of one composition to PNG with a single browser.
// usage: node scripts/stills.mjs <compId> <outDir> <scale> <frame,frame,...> [bundleDir]
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [, , compId, outDir, scaleArg, framesArg, bundleArg] = process.argv;
const scale = Number(scaleArg);
const frames = framesArg.split(",").map(Number);
mkdirSync(outDir, { recursive: true });
const serveUrl =
  bundleArg && existsSync(bundleArg)
    ? bundleArg
    : await bundle({ entryPoint: path.resolve("src/index.ts") });
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const chromiumOptions = { gl: "angle" };
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
const composition = await selectComposition({ serveUrl, id: compId, puppeteerInstance: browser, chromiumOptions, browserExecutable });
for (const frame of frames) {
  const t0 = performance.now();
  await renderStill({
    serveUrl,
    composition,
    frame,
    output: path.join(outDir, `${compId}_f${String(frame).padStart(4, "0")}.png`),
    scale,
    imageFormat: "png",
    puppeteerInstance: browser,
    chromiumOptions,
    browserExecutable,
    timeoutInMilliseconds: 600000,
    overwrite: true,
    onBrowserLog: (l) => { if (l.text.startsWith('[')) console.log(l.text); },
  });
  console.log(`frame ${frame}: ${(performance.now() - t0).toFixed(0)} ms`);
}
await browser.close({ silent: true });
