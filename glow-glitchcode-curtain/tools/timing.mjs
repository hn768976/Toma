// Per-frame render time, measured with the Remotion renderer API, one tab
// (concurrency 1), warm-up frame excluded.
//   node tools/timing.mjs <CompositionId> <scale> <startFrame> <count>
//   e.g. node tools/timing.mjs GlitchCode-MonoRGB 0.3333333333333333 300 20
//        node tools/timing.mjs GlitchCode-MonoRGB 1 300 1      # one real 4K frame
import { selectComposition, renderFrames } from "@remotion/renderer";
import { existsSync } from "node:fs";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
const outDir = mkdtempSync(path.join(os.tmpdir(), "timing-"));

const [id, scaleArg = "1", startArg = "300", countArg = "20"] = process.argv.slice(2);
const scale = Number(scaleArg), start = Number(startArg), count = Number(countArg);
const serveUrl = path.resolve("out/bundle");
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const common = { serveUrl, browserExecutable, chromiumOptions: { gl: "angle" }, logLevel: "error" };

const composition = await selectComposition({ ...common, id });
const times = [];
await renderFrames({
  ...common,
  composition,
  scale,
  imageFormat: "png",
  outputDir: outDir,
  concurrency: 1,
  frameRange: [start, start + count], // one extra, the first is a warm-up
  onStart: () => {},
  timeoutInMilliseconds: 600000,
  onFrameUpdate: (_n, frame, ms) => times.push({ frame, ms }),
});
const t = times.sort((a, b) => a.frame - b.frame).map((x) => x.ms);
const timed = count > 1 ? t.slice(1) : t;
timed.sort((a, b) => a - b);
const median = timed[Math.floor(timed.length / 2)];
rmSync(outDir, { recursive: true, force: true });
console.log(JSON.stringify({ id, scale, frames: timed.length, medianMs: Math.round(median), meanMs: Math.round(timed.reduce((a, b) => a + b, 0) / timed.length), minMs: Math.round(timed[0]), maxMs: Math.round(timed[timed.length - 1]) }));
