/**
 * Renders the twelve stills and the contact sheet.
 *
 *   node --experimental-strip-types scripts/render-batch.ts
 *   npm run batch
 *
 * Optional environment:
 *   REMOTION_BROWSER_EXECUTABLE  path to an existing Chrome/Chromium
 *   OUT_DIR                      output root, default ./out
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type BatchEntry = { composition: string; palette: string };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = process.env.OUT_DIR ?? join(root, "out");
const stillsDir = join(outRoot, "stills");

const batch: BatchEntry[] = JSON.parse(
  readFileSync(join(root, "src", "batch.json"), "utf8"),
);

const remotion = (args: string[]): void => {
  execFileSync("npx", ["remotion", ...args], {
    cwd: root,
    stdio: "inherit",
  });
};

mkdirSync(stillsDir, { recursive: true });

batch.forEach((entry, i) => {
  const name = `trading-${entry.composition}-${entry.palette}.png`;
  console.log(`[${i + 1}/${batch.length}] ${name}`);
  remotion([
    "still",
    "TradingMacro",
    join(stillsDir, name),
    `--props=${JSON.stringify(entry)}`,
  ]);
});

console.log("contact sheet");
remotion(["still", "ContactSheet", join(outRoot, "contact-sheet.png")]);

console.log(`\nDone. ${batch.length} stills in ${stillsDir}`);
