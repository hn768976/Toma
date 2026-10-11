// Render selected frames of a composition as PNGs, reusing one bundle + browser.
// usage: node tools/stills.mjs <compId> <outDir> <scale> <frame,frame,...> [--loopcheck]
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [comp, outDir, scaleS, framesS, ...rest] = process.argv.slice(2);
const loop = rest.includes("--loopcheck");
if (loop) process.env.REMOTION_LOOP_CHECK = "1";
mkdirSync(outDir, { recursive: true });
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const envVariables = loop ? { REMOTION_LOOP_CHECK: "1", REMOTION_NO_WRAP: "1" } : {};
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const chromiumOptions = { gl: "angle" };
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
const composition = await selectComposition({ serveUrl, id: comp, envVariables, puppeteerInstance: browser, browserExecutable, chromiumOptions, timeoutInMilliseconds: 120000 });
for (const f of framesS.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({
    composition, serveUrl, frame: f, envVariables, output: path.join(outDir, `${comp}_${String(f).padStart(4, "0")}.png`),
    scale: Number(scaleS), puppeteerInstance: browser, browserExecutable, chromiumOptions, imageFormat: "png", overwrite: true,
    timeoutInMilliseconds: 180000,
  });
  console.log(`frame ${f}: ${Date.now() - t0} ms`);
}
await browser.close({ silent: true });
