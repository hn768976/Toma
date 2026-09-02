/**
 * Vendors the exact font files that @remotion/google-fonts points at into
 * public/fonts, so that a render never depends on reaching fonts.gstatic.com.
 *
 * The font identity (family name, version, file URLs) still comes from
 * @remotion/google-fonts — this script only mirrors the files it names.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "public", "fonts");

// Playfair Display ships as a variable font, so one file serves every weight
// in its range; PT Serif ships a static file per weight.
const WANTED = [
  { module: "@remotion/google-fonts/PlayfairDisplay", file: "PlayfairDisplay", weights: ["900"], weightRange: "400 900" },
  { module: "@remotion/google-fonts/PTSerif", file: "PTSerif", weights: ["400", "700"] },
];

await mkdir(outDir, { recursive: true });

const manifest = [];

for (const entry of WANTED) {
  const info = require(entry.module).getInfo();
  for (const weight of entry.weights) {
    const url = info.fonts.normal[weight].latin;
    const name = `${entry.file}-${entry.weightRange ? "variable" : weight}.woff2`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(outDir, name), buf);
    manifest.push({
      family: info.fontFamily,
      weight: entry.weightRange ?? weight,
      file: name,
      bytes: buf.length,
      url,
    });
    console.log(`${name}  ${buf.length} bytes  (${info.fontFamily} ${weight})`);
  }
}

await writeFile(
  path.join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`\nWrote ${manifest.length} files to ${outDir}`);
