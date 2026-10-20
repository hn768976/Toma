// Shared rendering helpers on Remotion's Node API: bundle once, reuse one
// browser, render stills or frame ranges by composition id.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
export const browserExecutable = existsSync(shell) ? shell : null;

export const IDS = {
  OverbalancedWheel: "PerpetualMotion-OverbalancedWheel",
  WaterScrewMill: "PerpetualMotion-WaterScrewMill",
  SelfFlowingFlask: "PerpetualMotion-SelfFlowingFlask",
  MagnetRamp: "PerpetualMotion-MagnetRamp",
  RollingBallWheel: "PerpetualMotion-RollingBallWheel",
};

export async function setup() {
  const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts"), onProgress: () => {} });
  const browser = await openBrowser("chrome", { browserExecutable });
  return { serveUrl, browser };
}

export async function still(ctx, id, frame, output, { scale = 1, props = {} } = {}) {
  const inputProps = { look: "workshop", verify: false, ...props };
  const composition = await selectComposition({ serveUrl: ctx.serveUrl, id, inputProps, puppeteerInstance: ctx.browser, browserExecutable });
  const t0 = performance.now();
  await renderStill({ composition, serveUrl: ctx.serveUrl, output, frame, scale, inputProps, puppeteerInstance: ctx.browser, browserExecutable, imageFormat: "png", overwrite: true });
  return performance.now() - t0;
}
