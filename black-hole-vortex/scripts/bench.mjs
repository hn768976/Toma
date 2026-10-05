// Dev helper: measure steady-state render time per frame (excludes bundling,
// page load and shader compile). usage: node scripts/bench.mjs <scale> <quality> <comp> [nFrames]
import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const [scaleS, quality, id, nS = "6"] = process.argv.slice(2);
const n = Number(nS);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = fs.existsSync("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
  ? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" : null;
const chromiumOptions = { gl: "angle" };
const inputProps = { shotId: id.replace("-", "_"), quality, durationOverride: null };
const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable, chromiumOptions });
const times = [];
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-"));
await renderFrames({
  serveUrl, composition, inputProps, browserExecutable, chromiumOptions, concurrency: 1, scale: Number(scaleS),
  frameRange: [300, 300 + n - 1], imageFormat: "png", outputDir, timeoutInMilliseconds: 900000,
  onStart: () => {}, onFrameUpdate: () => times.push(performance.now()),
});
fs.rmSync(outputDir, { recursive: true });
const per = (times[times.length - 1] - times[0]) / (times.length - 1) / 1000;
console.log(`BENCH ${id} scale=${scaleS} quality=${quality}: ${per.toFixed(2)} s/frame (steady state, ${n} frames)`);
