/**
 * Render the sixteen stills — each of the eight compositions in two palettes —
 * and then the contact sheet.
 *
 * Palette pairs are assigned deliberately in src/compositions.ts (BATCH_PAIRS);
 * w04 is the dark composition and gets the two dark palettes.
 *
 * Run with: npm run batch
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { BATCH_PAIRS } from "../src/compositions";

const OUT_DIR = "out/stills";
const SHEET = "out/contact-sheet.png";

mkdirSync(OUT_DIR, { recursive: true });

const remotion = (args: string[]) => {
  execFileSync("npx", ["remotion", ...args], { stdio: "inherit" });
};

const jobs = BATCH_PAIRS.flatMap((pair) =>
  pair.palettes.map((palette) => ({
    composition: pair.composition,
    palette,
    file: `${OUT_DIR}/washi-${pair.composition}-${palette}.png`,
  })),
);

console.log(`Rendering ${jobs.length} stills into ${OUT_DIR}/\n`);

jobs.forEach((job, index) => {
  console.log(`[${index + 1}/${jobs.length}] ${job.file}`);
  remotion([
    "still",
    "WashiMotif",
    job.file,
    `--props=${JSON.stringify({
      composition: job.composition,
      palette: job.palette,
    })}`,
  ]);
});

console.log(`\nRendering the contact sheet into ${SHEET}`);
remotion(["still", "ContactSheet", SHEET]);

console.log("\nDone.");
