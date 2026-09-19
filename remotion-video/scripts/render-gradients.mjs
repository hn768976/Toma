#!/usr/bin/env node
/**
 * Renders every gradient variant to H.264 MP4.
 *
 *   node scripts/render-gradients.mjs            # all variants at 1080p
 *   node scripts/render-gradients.mjs --uhd      # all variants at 4K
 *   node scripts/render-gradients.mjs V2 V4      # just those variants
 *
 * 4K renders are considerably slower than 1080p on a software GL backend --
 * four times the pixels in the finishing pass. The noise field itself costs
 * the same at either size, because it is evaluated at a fixed offscreen
 * resolution.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const IDS = [
  "V1-MidnightBloom",
  "V2-HolographicFoil",
  "V3-CyanDrift",
  "V4-DeepCurrent",
];

const args = process.argv.slice(2);
const uhd = args.includes("--uhd");
// Grain is expensive to encode, so the grainy variant lands much larger than
// the others at a given CRF. Raise this if file size matters more than the
// last of the texture.
const crfArg = args.find((a) => a.startsWith("--crf="));
const crf = crfArg ? crfArg.slice("--crf=".length) : "18";
const filters = args.filter((a) => !a.startsWith("--"));

const selected = filters.length
  ? IDS.filter((id) => filters.some((f) => id.toLowerCase().includes(f.toLowerCase())))
  : IDS;

if (selected.length === 0) {
  console.error(`No variant matched. Available:\n  ${IDS.join("\n  ")}`);
  process.exit(1);
}

const suffix = uhd ? "4K" : "1080p";
const outDir = join(root, "out", suffix);
mkdirSync(outDir, { recursive: true });

for (const id of selected) {
  const composition = `${id}-${suffix}`;
  const output = join(outDir, `${id}-${suffix}.mp4`);
  console.log(`\n=== ${composition} -> ${output}`);

  const result = spawnSync(
    "npx",
    [
      "remotion",
      "render",
      composition,
      output,
      "--codec=h264",
      "--gl=swangle",
      `--crf=${crf}`,
      "--pixel-format=yuv420p",
      // No audio: these are background plates, and a silent AAC track also
      // pads the file past an exact frame count, which spoils a clean loop.
      "--muted",
      "--color-space=bt709",
      "--log=info",
    ],
    { cwd: root, stdio: "inherit" },
  );

  if (result.status !== 0) {
    console.error(`Render failed for ${composition}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\nDone. ${selected.length} file(s) in ${outDir}`);
