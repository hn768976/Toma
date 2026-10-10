// Render specific frames of a composition to PNG with one bundle + one browser.
// usage: node scripts/frames.mjs <compId> <outDir> <scale> <frame,frame,...> [bundleDir]
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [id, outDir, scaleStr, framesStr, bundleDir] = process.argv.slice(2);
const scale = Number(scaleStr);
const frames = framesStr.split(",").map(Number);
mkdirSync(outDir, { recursive: true });
const serveUrl =
  bundleDir && existsSync(path.join(bundleDir, "index.html")) && process.env.REUSE
    ? bundleDir
    : await bundle({ entryPoint: path.resolve("src/index.ts"), outDir: path.resolve(bundleDir ?? "out/bundle") });
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(exe) ? exe : null;
const chromiumOptions = { gl: "angle" };
// LOOP_CHECK=1: compositions become 601 frames so frame 600 can be rendered.
const envVariables = process.env.LOOP_CHECK ? { REMOTION_LOOP_CHECK: "1" } : {};
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, chromiumOptions, browserExecutable, envVariables });
for (const frame of frames) {
  const t0 = performance.now();
  await renderStill({
    composition, serveUrl, frame, scale, puppeteerInstance: browser, chromiumOptions, browserExecutable,
    output: path.join(outDir, `${id}_f${String(frame).padStart(4, "0")}.png`),
    imageFormat: "png", overwrite: true, timeoutInMilliseconds: 300000, envVariables,
  });
  console.log(`${id} frame ${frame}: ${((performance.now() - t0) / 1000).toFixed(2)}s`);
}
await browser.close({ silent: true });
