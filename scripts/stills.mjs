/**
 * Renders the verification stills used to eyeball the loop and the composition.
 *
 * Frames 0 and 449 sit either side of the loop point and should be
 * indistinguishable; 60 / 150 / 300 sample the density arc.
 *
 * Run: npm run stills [-- CompositionId]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const composition = process.argv[2] ?? "NeonStreaks";
const frames = [0, 60, 150, 300, 449];
const outDir = `out/stills`;

mkdirSync(outDir, { recursive: true });

// Some environments ship a Chromium that Remotion should use instead of
// downloading its own; set REMOTION_BROWSER to that binary if so.
const browser = process.env.REMOTION_BROWSER;

for (const frame of frames) {
  const args = [
    "remotion",
    "still",
    composition,
    `${outDir}/${composition}-f${frame}.png`,
    `--frame=${frame}`,
  ];
  if (browser) args.push(`--browser-executable=${browser}`);
  execFileSync("npx", args, { stdio: "inherit" });
}

console.log(`\nWrote ${frames.length} stills to ${outDir}/`);
