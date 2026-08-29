// Refreshes the vendored IBM Plex Sans subsets in public/fonts.
//
// The family name, subset unicode-ranges and woff2 URLs all come from
// @remotion/google-fonts, so this stays in step with that package; the files
// are downloaded once here rather than fetched during a render.
//
//   node scripts/vendor-font.mjs

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getInfo } from "@remotion/google-fonts/IBMPlexSans";

const WEIGHT = "300";
const STYLES = ["normal", "italic"];
const SUBSETS = ["latin", "greek"];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "fonts", "ibm-plex-sans");
const info = getInfo();

await mkdir(outDir, { recursive: true });

for (const style of STYLES) {
  for (const subset of SUBSETS) {
    const url = info.fonts[style][WEIGHT][subset];
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const file = join(outDir, `${style}-${WEIGHT}-${subset}.woff2`);
    await writeFile(file, bytes);
    console.log(`${style}/${subset}: ${bytes.length} bytes -> ${file}`);
  }
}
