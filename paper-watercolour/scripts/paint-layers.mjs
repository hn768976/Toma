// Paints every watercolour layer ONCE with p5.brush (fixed seeds) and saves
// grayscale PNGs to public/layers. Run: GL=swangle npm run paint [ids...]
import { getCompositions, renderStill } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { ROOT, browserExecutable, chromiumOptions, makeBundle } from "./common.mjs";

const only = process.argv.slice(2);
const serveUrl = await makeBundle();
const comps = (await getCompositions(serveUrl, { browserExecutable, chromiumOptions })).filter(
  (c) => c.id.startsWith("Paint-") && (only.length === 0 || only.includes(c.id.slice(6))),
);
const outDir = path.join(ROOT, "public/layers");
mkdirSync(outDir, { recursive: true });
for (const composition of comps) {
  const name = composition.id.slice(6).replace(/-/g, "_");
  const tmp = path.join(outDir, `${name}.rgb.png`);
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, output: tmp, imageFormat: "png", browserExecutable, chromiumOptions, scale: 1, timeoutInMilliseconds: 900_000 });
  // neutral pigment -> single-channel layer (white = bare paper)
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-vf", "format=gray", path.join(outDir, `${name}.png`)]);
  rmSync(tmp);
  console.log(`${name}: ${composition.width}x${composition.height} painted in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
