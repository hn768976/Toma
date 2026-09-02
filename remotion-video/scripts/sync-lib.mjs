/**
 * Vendors the shared library (~/projects/remotion-lib/src) into src/lib.
 *
 * The files are copied rather than linked or installed as a dependency so that
 * a distributed zip of this project renders standalone with no external path.
 * Each copy carries a header naming the source; the content below the header
 * is byte-identical to the library, and `--check` verifies that.
 *
 *   node scripts/sync-lib.mjs          # copy library -> src/lib
 *   node scripts/sync-lib.mjs --check  # fail if src/lib has drifted
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const libSrc = path.join(homedir(), "projects", "remotion-lib", "src");
const dest = path.join(here, "..", "src", "lib");
const check = process.argv.indexOf("--check") !== -1;

const HEADER = [
  "// Vendored from remotion-lib (~/projects/remotion-lib/src).",
  "// Do not edit here: change it in the library and re-run",
  "// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.",
  "",
].join("\n");

const stripHeader = (text) =>
  text.startsWith("// Vendored from remotion-lib") ? text.split("\n").slice(4).join("\n") : text;

await mkdir(dest, { recursive: true });
const files = (await readdir(libSrc)).filter((f) => f.endsWith(".ts")).sort();

let drift = 0;
for (const file of files) {
  const body = await readFile(path.join(libSrc, file), "utf8");
  const target = path.join(dest, file);
  if (check) {
    let current = "";
    try {
      current = stripHeader(await readFile(target, "utf8"));
    } catch {
      current = "";
    }
    if (current !== body) {
      console.error(`DRIFT: src/lib/${file} differs from the library`);
      drift++;
    }
    continue;
  }
  await writeFile(target, HEADER + body);
  console.log(`vendored src/lib/${file}`);
}

if (check) {
  if (drift > 0) {
    console.error(`\n${drift} file(s) out of sync with remotion-lib.`);
    process.exit(1);
  }
  console.log(`src/lib matches remotion-lib (${files.length} files).`);
} else {
  console.log(`\nVendored ${files.length} files into src/lib.`);
}
