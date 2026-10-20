// The 10 stills: each machine in both looks, 6000 × 3375 PNG (the 3840 × 2160
// composition at scale 1.5625) and the matching vector SVG.
// Usage: node scripts/render-stills.mjs [frame] [Name ...]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { IDS, root, setup, still } from "./render-lib.mjs";

const frame = Number(process.argv[2] ?? 0);
const names = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(IDS);
const out = join(root, "renders", "stills");
mkdirSync(out, { recursive: true });

const bundled = join(root, "renders", ".svg-entry.mjs");
await build({ entryPoints: [join(root, "scripts", "svg-entry.tsx")], bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external", outfile: bundled, logLevel: "error" });
const { svgOf } = await import(pathToFileURL(bundled).href);

const ctx = await setup();
for (const name of names) {
  for (const look of ["workshop", "blueprint"]) {
    const base = join(out, `PerpetualMotion_${name}_${look === "workshop" ? "Workshop" : "Blueprint"}`);
    writeFileSync(`${base}.svg`, svgOf(IDS[name], look, frame, 6000, 3375));
    const ms = await still(ctx, IDS[name], frame, `${base}.png`, { scale: 6000 / 3840, props: { look } });
    console.log(`${name} ${look}: ${(ms / 1000).toFixed(1)} s`);
  }
}
await ctx.browser.close({ silent: true });
