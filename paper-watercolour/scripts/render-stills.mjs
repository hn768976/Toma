// Renders the 16 stills.
//   review:  GL=swangle node scripts/render-stills.mjs                (1280x720 each, then StillsSheet.png)
//   masters: GL=angle   node scripts/render-stills.mjs --scale=1 --out=stills-6k   (6000x3375)
import { getCompositions, renderStill } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, browserExecutable, chromiumOptions, makeBundle } from "./common.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((x) => x.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=")[1];
const scale = Number(opt("scale", String(1280 / 6000)));
const outDir = path.join(ROOT, opt("out", "renders/stills"));
mkdirSync(outDir, { recursive: true });
const serveUrl = await makeBundle();
const comps = (await getCompositions(serveUrl, { browserExecutable, chromiumOptions })).filter((c) => /^S\d-/.test(c.id));
const times = {};
for (const composition of comps) {
  const t0 = Date.now();
  const output = path.join(outDir, `${composition.id}.png`);
  await renderStill({ composition, serveUrl, output, scale, imageFormat: "png", browserExecutable, chromiumOptions, timeoutInMilliseconds: 900_000 });
  times[composition.id] = (Date.now() - t0) / 1000;
  console.log(`${composition.id}: ${times[composition.id].toFixed(1)}s`);
}
writeFileSync(path.join(outDir, "times.json"), JSON.stringify(times, null, 2));
if (scale < 0.5) execFileSync("python3", [path.join(ROOT, "scripts/stills-sheet.py"), outDir], { stdio: "inherit" });
