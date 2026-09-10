/**
 * Renders the sixteen stills: each of the eight compositions in the two
 * palettes paired with it in src/compositions.ts.
 *
 * Usage
 *   npx tsx scripts/render-batch.ts                 all sixteen, 4K
 *   npx tsx scripts/render-batch.ts --scale=0.25    quick low-res proofs
 *   npx tsx scripts/render-batch.ts g02 g07         only those compositions
 *   npx tsx scripts/render-batch.ts --out=out/x     somewhere other than
 *                                                   out/stills
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { BATCH_PAIRS, COMPOSITION_NAMES, type CompositionName } from "../src/compositions";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const outDir = flag("out") ?? path.join("out", "stills");
const scale = flag("scale");
const only = args.filter((a) => !a.startsWith("--")) as CompositionName[];
const selected = only.length > 0 ? only : COMPOSITION_NAMES;

for (const name of selected) {
  if (!COMPOSITION_NAMES.includes(name)) {
    throw new Error(`Unknown composition "${name}". Known: ${COMPOSITION_NAMES.join(", ")}`);
  }
}

mkdirSync(outDir, { recursive: true });

const jobs = selected.flatMap((composition) =>
  BATCH_PAIRS[composition].map((palette) => ({ composition, palette })),
);

let index = 0;
for (const { composition, palette } of jobs) {
  index++;
  const file = path.join(outDir, `graingrad-${composition}-${palette}.png`);
  const cliArgs = [
    "remotion",
    "still",
    "GrainGradient",
    file,
    `--props=${JSON.stringify({ composition, palette })}`,
  ];
  if (scale) cliArgs.push(`--scale=${scale}`);

  process.stdout.write(`[${index}/${jobs.length}] ${composition} · ${palette}\n`);
  execFileSync("npx", cliArgs, { stdio: ["ignore", "ignore", "inherit"] });
}

process.stdout.write(`\nWrote ${jobs.length} stills to ${outDir}\n`);
