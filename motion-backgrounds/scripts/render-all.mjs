#!/usr/bin/env node
/**
 * Renders every composition through the Remotion CLI.
 *
 * Compositions are authored at 3840x2160. `--scale` picks the delivery size:
 *   --scale=0.5  -> 1920x1080  (default; the deliverable masters)
 *   --scale=1    -> 3840x2160  (full 4K)
 *
 * Scale maps onto the browser's devicePixelRatio, and ShaderStage sizes its
 * canvas in device pixels, so the shader runs at the true output resolution
 * rather than shading 4K and downsampling.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const COMPOSITIONS = [
  "SilkWeaveNavy",
  "SilkWeaveMagenta",
  "CausticBloomRose",
  "CausticBloomAzure",
];

const args = process.argv.slice(2);
const scaleArg = args.find((a) => a.startsWith("--scale="));
const scale = scaleArg ? Number(scaleArg.split("=")[1]) : 0.5;
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const concurrency = args.find((a) => a.startsWith("--concurrency="));

const label = `${Math.round(3840 * scale)}x${Math.round(2160 * scale)}`;
const outDir = resolve(root, "out", label);
mkdirSync(outDir, { recursive: true });

const run = (composition) =>
  new Promise((res, rej) => {
    const out = resolve(outDir, `${composition}_${label}.mp4`);
    const cliArgs = [
      "remotion",
      "render",
      composition,
      out,
      `--scale=${scale}`,
      "--codec=h264",
      "--pixel-format=yuv420p",
      "--log=info",
    ];
    if (concurrency) cliArgs.push(concurrency);
    if (process.env.REMOTION_BROWSER_EXECUTABLE) {
      cliArgs.push(`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`);
    }

    console.log(`\n=== ${composition} -> ${label} ===`);
    const child = spawn("npx", cliArgs, { cwd: root, stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? res(out) : rej(new Error(`${composition} exited ${code}`)),
    );
  });

const targets = only ? COMPOSITIONS.filter((c) => c === only) : COMPOSITIONS;
if (targets.length === 0) {
  console.error(`No composition matched --only=${only}`);
  process.exit(1);
}

for (const c of targets) {
  await run(c);
}
console.log(`\nAll renders complete -> out/${label}/`);
