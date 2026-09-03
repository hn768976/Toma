/**
 * Copies the shared library (~/projects/remotion-lib) into src/vendor.
 *
 * The library is source-only and has no build step, and every zip of this
 * project must be standalone, so the library is vendored rather than linked.
 * Run `node scripts/sync-lib.mjs` to refresh, or `--check` to verify that the
 * vendored copy still matches the library.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
// The library's working location, with a fallback to the copy kept alongside
// this project in the repo so a fresh checkout can still sync.
const CANDIDATES = [
  process.env.REMOTION_LIB,
  join(homedir(), "projects/remotion-lib"),
  join(here, "..", "..", "remotion-lib"),
].filter(Boolean);
const LIB = CANDIDATES.find((dir) => existsSync(join(dir, "src"))) ?? CANDIDATES[0];
const SRC = join(LIB, "src");
const DEST = join(here, "..", "src", "vendor");
const check = process.argv.includes("--check");

if (!existsSync(SRC)) {
  console.error(`Library not found at ${SRC}. Set REMOTION_LIB to override.`);
  process.exit(check ? 0 : 1);
}

mkdirSync(DEST, { recursive: true });
const banner = (name) =>
  `// Vendored from @studio/remotion-lib (src/${name}). Do not edit here —\n` +
  `// edit the library and re-run \`node scripts/sync-lib.mjs\`.\n`;

let drift = 0;
for (const name of readdirSync(SRC).filter((f) => f.endsWith(".ts"))) {
  const wanted = banner(name) + readFileSync(join(SRC, name), "utf8");
  const target = join(DEST, name);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (current === wanted) continue;
  if (check) {
    console.error(`drift: src/vendor/${name}`);
    drift += 1;
  } else {
    writeFileSync(target, wanted);
    console.log(`synced src/vendor/${name}`);
  }
}
if (check) {
  console.log(drift === 0 ? "vendor matches library" : `${drift} file(s) differ`);
  process.exit(drift === 0 ? 0 : 1);
}
