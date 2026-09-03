/**
 * Vendors ~/projects/remotion-lib/src into src/shared so this project ships
 * standalone. Run `node scripts/sync-shared.mjs` to pull updates, or
 * `--check` to verify the vendored copy is byte-identical to the library.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const LIB = join(homedir(), "projects", "remotion-lib", "src");
const DEST = join(here, "..", "src", "shared");
const check = process.argv.includes("--check");

if (!existsSync(LIB)) {
  console.log(`remotion-lib not present at ${LIB} — using the vendored copy in src/shared.`);
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });
let drift = 0;
for (const f of readdirSync(LIB)) {
  const from = readFileSync(join(LIB, f), "utf8");
  const to = join(DEST, f);
  const cur = existsSync(to) ? readFileSync(to, "utf8") : null;
  if (cur === from) continue;
  drift++;
  if (check) console.error(`DRIFT: src/shared/${f} differs from the library`);
  else { writeFileSync(to, from); console.log(`synced ${f}`); }
}
if (check) {
  console.log(drift === 0 ? "src/shared is identical to remotion-lib" : `${drift} file(s) differ`);
  process.exit(drift === 0 ? 0 : 1);
}
console.log(drift === 0 ? "already up to date" : `synced ${drift} file(s)`);
