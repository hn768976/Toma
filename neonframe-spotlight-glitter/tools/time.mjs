// Per-frame render time (Remotion's own per-frame timer, concurrency 1, frames 300..).
// usage: node tools/time.mjs <compId> <scale> <nFrames>
import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import { existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const [compId, scaleArg, nArg] = process.argv.slice(2);
const scale = Number(scaleArg), n = Number(nArg);
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(pw) ? pw : undefined;
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), onProgress: () => {} });
const chromiumOptions = { gl: "angle" };
const composition = await selectComposition({ serveUrl, id: compId, inputProps: {}, browserExecutable, chromiumOptions });
const times = [];
const t0 = Date.now();
await renderFrames({
  composition, serveUrl, inputProps: {}, browserExecutable, chromiumOptions, scale,
  frameRange: [300, 300 + n - 1], concurrency: 1, imageFormat: "png",
  outputDir: mkdtempSync(path.join(os.tmpdir(), "t-")),
  onFrameUpdate: (_done, _frame, ms) => times.push(ms),
  onStart: () => {},
});
const total = Date.now() - t0;
const rest = times.slice(1).sort((a, b) => a - b);
const med = rest[Math.floor(rest.length / 2)];
console.log(JSON.stringify({ compId, scale, size: `${Math.round(3840 * scale)}x${Math.round(2160 * scale)}`, frames: n,
  firstFrameMs: times[0], steadyMedianMs: med, steadyMeanMs: Math.round(rest.reduce((a, b) => a + b, 0) / rest.length), allMs: times, wallMs: total }));
