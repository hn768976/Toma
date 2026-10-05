// Dev helper: bundle once, render stills for several compositions/frames and
// print per-frame timings.
// usage: node scripts/stills.mjs <outDir> <scale> <quality> <comp:frame,frame> [...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const [outDir, scaleS, quality, ...specs] = process.argv.slice(2);
const scale = Number(scaleS);
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = fs.existsSync("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
  ? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
  : null;
const chromiumOptions = { gl: "angle" };
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
for (const spec of specs) {
  const [id, framesS] = spec.split(":");
  const inputProps = { shotId: id.replace("-", "_"), quality, durationOverride: 601 };
  const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser, chromiumOptions });
  for (const f of framesS.split(",").map(Number)) {
    const t0 = performance.now();
    await renderStill({
      serveUrl, composition, frame: f, scale, inputProps, puppeteerInstance: browser, chromiumOptions,
      output: path.join(outDir, `${id}_${f}.png`), imageFormat: "png", timeoutInMilliseconds: 900000,
    });
    console.log(`${id} frame ${f}: ${((performance.now() - t0) / 1000).toFixed(2)}s`);
  }
}
await browser.close({ silent: true });
