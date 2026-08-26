// Downloads the exact woff2 files that @remotion/google-fonts points at, into
// public/fonts/, so a render never depends on reaching fonts.gstatic.com.
//
// The package stays the source of truth: family names, weights and file URLs
// all come out of its getInfo(). Re-run after changing FACES, then commit the
// files it writes.
//
//   node scripts/fetch-fonts.mjs

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getInfo as interInfo } from "@remotion/google-fonts/Inter";
import { getInfo as serifInfo } from "@remotion/google-fonts/SourceSerif4";

const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "fonts",
);

const SUBSET = "latin";

// Both families ship as variable fonts, so Google serves one file per family
// covering the whole weight axis. We take the file the lightest requested
// weight resolves to and declare the full range on the @font-face.
const FACES = [
  { info: interInfo(), weights: ["500", "700", "900"] },
  { info: serifInfo(), weights: ["400", "600"] },
];

const slug = (family) => family.replace(/\s+/g, "");

await mkdir(OUT_DIR, { recursive: true });

const manifest = [];

for (const { info, weights } of FACES) {
  const urls = new Set(
    weights.map((weight) => {
      const url = info.fonts.normal?.[weight]?.[SUBSET];
      if (!url) throw new Error(`No ${SUBSET} ${weight} for ${info.fontFamily}`);
      return url;
    }),
  );
  if (urls.size !== 1) {
    throw new Error(
      `${info.fontFamily} is not a single variable file: ${urls.size} urls`,
    );
  }
  const url = [...urls][0];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const file = `${slug(info.fontFamily)}.woff2`;
  await writeFile(resolve(OUT_DIR, file), Buffer.from(await res.arrayBuffer()));
  manifest.push({ family: info.fontFamily, weights, file });
  console.log(`${file}  <-  ${url}`);
}

console.log(`\n${manifest.length} faces written to public/fonts`);
