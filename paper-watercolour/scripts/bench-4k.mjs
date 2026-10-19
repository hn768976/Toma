// Times single 4K frames (scale 1). Renders 3 consecutive frames in one tab
// and reports Remotion's per-frame render time (excludes browser start-up).
//   GL=swangle node scripts/bench-4k.mjs [ids...]
import { getCompositions, renderFrames } from "@remotion/renderer";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ROOT, browserExecutable, chromiumOptions, makeBundle } from "./common.mjs";

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["WatercolourBloom-Pastel", "WatercolourBloom-Pastel-LiveBrush", "InkReveal-Indigo", "Chalkboard-Green"];
const serveUrl = await makeBundle();
const comps = await getCompositions(serveUrl, { browserExecutable, chromiumOptions });
const file = path.join(ROOT, "renders/bench-4k.json");
const results = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
for (const id of ids) {
  const composition = comps.find((c) => c.id === id);
  const dir = path.join(ROOT, "renders/bench", id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const times = [];
  const t0 = Date.now();
  await renderFrames({
    composition, serveUrl, outputDir: dir, imageFormat: "png", scale: 1, concurrency: 1,
    frameRange: [300, 302], browserExecutable, chromiumOptions, timeoutInMilliseconds: 900_000,
    onStart: () => {}, onFrameUpdate: (_d, f, ms) => times.push({ frame: f, ms }),
  });
  results[id] = { gl: chromiumOptions.gl, width: composition.width, height: composition.height, frames: times, wallSeconds: (Date.now() - t0) / 1000 };
  writeFileSync(file, JSON.stringify(results, null, 2));
  console.log(id, JSON.stringify(times));
}
