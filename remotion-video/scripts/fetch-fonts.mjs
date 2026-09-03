/**
 * Vendors the two Google faces the node-hub compositions use into
 * public/fonts/ so rendering never depends on a network fetch (and so the
 * distributed project is standalone).
 *
 * `@remotion/google-fonts` stays the source of truth: the family names and
 * the exact woff2 URLs are read from its metadata rather than hardcoded.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import { getInfo as condensedInfo } from "@remotion/google-fonts/BarlowCondensed";
import { getInfo as monoInfo } from "@remotion/google-fonts/ShareTechMono";

const WANTED = [
  { info: condensedInfo(), weights: ["400", "500", "600"], slug: "barlow-condensed" },
  { info: monoInfo(), weights: ["400"], slug: "share-tech-mono" },
];

await mkdir(new URL("../public/fonts/", import.meta.url), { recursive: true });

const manifest = [];
for (const { info, weights, slug } of WANTED) {
  for (const weight of weights) {
    const url = info.fonts.normal?.[weight]?.latin;
    if (!url) throw new Error(`no latin url for ${info.fontFamily} ${weight}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const file = `${slug}-${weight}.woff2`;
    await writeFile(
      new URL(`../public/fonts/${file}`, import.meta.url),
      Buffer.from(await res.arrayBuffer()),
    );
    manifest.push({ family: info.fontFamily, weight, file, source: url });
    console.log(`${file}  <-  ${url}`);
  }
}

await writeFile(
  new URL("../public/fonts/manifest.json", import.meta.url),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`wrote ${manifest.length} faces + manifest.json`);
