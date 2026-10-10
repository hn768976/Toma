// Dev helper: render several stills of one composition from a single bundle.
// usage: node tools/stills.mjs <compId> <outDir> <scale> <frame,frame,...> [--env=KEY=VAL]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [compId, outDir, scaleArg, framesArg] = process.argv.slice(2);
const scale = Number(scaleArg);
const frames = framesArg.split(",").map(Number);
mkdirSync(outDir, { recursive: true });
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(pw) ? pw : undefined;
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), onProgress: () => {} });
const chromiumOptions = { gl: "angle" };
const inputProps = {};
const composition = await selectComposition({ serveUrl, id: compId, inputProps, browserExecutable, chromiumOptions });
console.log(`bundle+select ${Date.now() - t0}ms`);
for (const f of frames) {
  const t = Date.now();
  await renderStill({
    composition, serveUrl, frame: f, scale, inputProps, browserExecutable, chromiumOptions,
    output: path.join(outDir, `${compId}_${String(f).padStart(4, "0")}.png`),
    imageFormat: "png", overwrite: true,
  });
  console.log(`frame ${f}: ${Date.now() - t}ms`);
}
