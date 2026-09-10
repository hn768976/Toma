/**
 * Renders out/contact-sheet.png from the stills in out/stills.
 *
 * Remotion serves images from public/, so the stills are staged there for the
 * length of the render and cleared afterwards — the sheet is a proof of a
 * batch, not project content, and 16 4K PNGs have no business in the repo.
 *
 * Usage
 *   npx tsx scripts/contact-sheet.ts               reads out/stills
 *   npx tsx scripts/contact-sheet.ts --in=out/x    reads somewhere else
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { BATCH_PAIRS, COMPOSITION_NAMES, stillFileName } from "../src/compositions";
import { CONTACT_SHEET_DIR } from "../src/ContactSheet";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const inDir = flag("in") ?? path.join("out", "stills");
const outFile = flag("out") ?? path.join("out", "contact-sheet.png");
const staging = path.join("public", CONTACT_SHEET_DIR);

const wanted = COMPOSITION_NAMES.flatMap((composition) =>
  BATCH_PAIRS[composition].map((palette) => stillFileName(composition, palette)),
);

const missing = wanted.filter((f) => !existsSync(path.join(inDir, f)));
if (missing.length > 0) {
  throw new Error(
    `Missing ${missing.length} still(s) in ${inDir}, starting with ${missing[0]}.\n` +
      `Run: npx tsx scripts/render-batch.ts`,
  );
}

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
for (const file of wanted) copyFileSync(path.join(inDir, file), path.join(staging, file));

try {
  mkdirSync(path.dirname(outFile), { recursive: true });
  execFileSync("npx", ["remotion", "still", "ContactSheet", outFile], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  process.stdout.write(`Wrote ${outFile}\n`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
