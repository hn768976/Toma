#!/usr/bin/env node
/**
 * Syncs the shared remotion-lib sources into src/lib/.
 *
 * The library is the canonical home for these modules; src/lib/ is a
 * machine-maintained mirror of it, never hand-edited. Vendoring rather than
 * package-linking is what keeps the shipped zip standalone.
 *
 *   node scripts/sync-lib.mjs          copy library -> src/lib
 *   node scripts/sync-lib.mjs --check  fail if they differ (CI / pre-zip)
 *
 * Edit the library, then re-run this. Never the other way round.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  resolve(here, "../../remotion-lib/src"),
  join(homedir(), "projects/remotion-lib/src"),
];
const source = candidates.find((c) => existsSync(c));
if (!source) {
  console.error(`remotion-lib not found. Looked in:\n  ${candidates.join("\n  ")}`);
  process.exit(1);
}

const target = resolve(here, "../src/lib");
mkdirSync(target, { recursive: true });

const check = process.argv.includes("--check");
const files = readdirSync(source).filter((f) => /\.tsx?$/.test(f));
let differing = 0;

for (const file of files) {
  const from = readFileSync(join(source, file), "utf8");
  const toPath = join(target, file);
  const to = existsSync(toPath) ? readFileSync(toPath, "utf8") : null;
  if (from === to) continue;
  differing++;
  if (check) {
    console.error(`out of sync: src/lib/${file}`);
  } else {
    writeFileSync(toPath, from);
    console.log(`synced: src/lib/${file}`);
  }
}

if (check && differing > 0) {
  console.error(`\n${differing} file(s) differ from ${source}. Run: node scripts/sync-lib.mjs`);
  process.exit(1);
}
console.log(
  check
    ? `src/lib is in sync with ${source} (${files.length} files)`
    : `done — ${files.length} files, ${differing} updated`,
);
