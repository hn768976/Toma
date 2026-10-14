// Per-frame render timing. Usage: node scripts/time-frames.mjs <scale> <from> <to> <concurrency> [ids...]
import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [scale, from, to, conc, ...ids] = process.argv.slice(2);
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = fs.existsSync(exe) ? exe : undefined;
const chromiumOptions = { gl: "angle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
for (const id of ids) {
  const composition = await selectComposition({ serveUrl, id, inputProps: {}, browserExecutable, chromiumOptions });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-"));
  const times = [];
  const t0 = Date.now();
  await renderFrames({ composition, serveUrl, inputProps: {}, outputDir: dir, imageFormat: "png", scale: Number(scale), frameRange: [Number(from), Number(to)],
    concurrency: Number(conc), browserExecutable, chromiumOptions, onStart: () => {}, onFrameUpdate: (_n, _f, ms) => times.push(ms) });
  const wall = Date.now() - t0;
  fs.rmSync(dir, { recursive: true, force: true });
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ id, scale: Number(scale), frames: times.length, medianMs: times[Math.floor(times.length / 2)], minMs: times[0], maxMs: times[times.length - 1], wallMs: wall }));
}
