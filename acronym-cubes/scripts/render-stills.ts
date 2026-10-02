// Renders stills for every acronym (or the ones named on the command line).
//
//   npx tsx scripts/render-stills.ts --hires            6000x3375, frame 200 + mid-tumble
//   npx tsx scripts/render-stills.ts --preview          1920x1080, frame 200 only
//   npx tsx scripts/render-stills.ts --hires ETF 401K   just those
//
// Bundles once, then calls `remotion still` per image. Output: out/stills/.

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { ACRONYMS, compositionId } from "../src/data/acronyms";
import { stillFrames } from "../src/lib/stills";
import { COMP_WIDTH } from "../src/lib/world";

const args = process.argv.slice(2);
const hires = args.includes("--hires");
const only = args.filter((a) => !a.startsWith("--"));
const rows = ACRONYMS.filter((r) => only.length === 0 || only.includes(r.id));

const scale = hires ? 6000 / COMP_WIDTH : 0.5; // 6000x3375 or 1920x1080
const outDir = hires ? "out/stills/6000" : "out/stills/1080";
mkdirSync(outDir, { recursive: true });

const run = (cmd: string, a: string[]) => {
  console.log(`$ ${cmd} ${a.join(" ")}`);
  execFileSync(cmd, a, { stdio: "inherit" });
};

run("npx", ["remotion", "bundle", "--out-dir", "build"]);

for (const row of rows) {
  const frames = stillFrames(row);
  const jobs: [string, number][] = [[`f${frames.rest}_rest`, frames.rest]];
  if (hires) jobs.push([`f${frames.tumble}_tumble`, frames.tumble]);
  for (const [tag, frame] of jobs) {
    run("npx", [
      "remotion",
      "still",
      "build",
      compositionId(row),
      `${outDir}/Cubes_${row.id}_${tag}.png`,
      `--frame=${frame}`,
      `--scale=${scale}`,
      "--image-format=png",
    ]);
  }
}
