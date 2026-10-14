// Per-frame render time, excluding browser start-up and bundling.
// Usage: node scripts/time-frames.mjs <scale> <from> <count> <CompId...>
import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
const [scale, from, count, ...ids] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = fs.existsSync(exe) ? exe : null;
const chromiumOptions = { gl: process.env.GL ?? "angle" };
for (const id of ids) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
  const stamps = [];
  const outputDir = `out/timing/${id}`;
  fs.mkdirSync(outputDir, { recursive: true });
  await renderFrames({
    composition, serveUrl, outputDir, imageFormat: "png", scale: Number(scale),
    frameRange: [Number(from), Number(from) + Number(count) - 1],
    concurrency: Number(process.env.CONC ?? 1), browserExecutable, chromiumOptions, timeoutInMilliseconds: 900000,
    onStart: () => {}, onFrameUpdate: () => stamps.push(Date.now()),
  });
  const per = (stamps.at(-1) - stamps[0]) / (stamps.length - 1);
  console.log(`${id} scale=${scale} frames=${stamps.length} per-frame=${(per / 1000).toFixed(2)}s (first frame incl. warm-up excluded)`);
}
