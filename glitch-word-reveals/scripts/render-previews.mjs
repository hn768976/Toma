// Renders the four 1080p previews with the same CLI command the README
// documents (H.264, yuv420p, CRF 16, 30fps, no audio — see remotion.config.ts)
// and records the measured render time per frame.
//   node scripts/render-previews.mjs [--only=DataRain-GENERATIVE-AI]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { outputNameFromId, root } from "./common.mjs";

const PREVIEWS = [
  "AttackGlitch-RANSOMWARE",
  "AttackGlitch-AI-SURVEILLANCE",
  "DataRain-GENERATIVE-AI",
  "DataRain-QUANTUM-COMPUTING",
];
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const outDir = path.join(root, "out", "previews");
mkdirSync(outDir, { recursive: true });

// Bundle once up front so the per-clip timing is rendering + encoding only.
const bundleDir = path.join(root, "out", "bundle");
execFileSync("npx", ["remotion", "bundle", "--out-dir", bundleDir, "--log=error"], { cwd: root, stdio: "inherit" });

const threads = os.cpus().length;
const timings = [];
for (const id of PREVIEWS) {
  if (only && id !== only) continue;
  const out = path.join(outDir, `${outputNameFromId(id)}.mp4`);
  const t0 = performance.now();
  execFileSync(
    "npx",
    ["remotion", "render", bundleDir, id, out, "--scale=0.5", `--concurrency=${threads}`, "--log=error"],
    { cwd: root, stdio: "inherit" },
  );
  const ms = performance.now() - t0;
  const msPerFrame = ms / 300;
  timings.push({ id, threads, totalSeconds: +(ms / 1000).toFixed(1), msPerFrame: +msPerFrame.toFixed(0) });
  console.log(`${id}: ${(ms / 1000).toFixed(1)}s total, ${msPerFrame.toFixed(0)} ms/frame -> ${path.relative(root, out)}`);
}
console.table(timings);
writeFileSync(path.join(outDir, "timings.json"), JSON.stringify(timings, null, 2));
