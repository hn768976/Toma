/**
 * Bundles once, then writes several stills — much faster than one
 * `remotion still` invocation per frame while iterating on the look.
 *
 * Usage: node scripts/stills.mjs <compositionId> <frame,frame,...> [scale]
 */
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [, , id = "V1-AIHologramDarkBlue", framesArg = "450", scaleArg = "0.5"] = process.argv;
const frames = framesArg.split(",").map(Number);
const scale = Number(scaleArg);

const browserExecutable = [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
].find((p) => existsSync(p));

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({
  serveUrl,
  id,
  browserExecutable,
  chromiumOptions: { gl: "angle" },
});
mkdirSync("out", { recursive: true });

for (const frame of frames) {
  const output = path.resolve(`out/${id}-f${frame}.png`);
  const t0 = Date.now();
  await renderStill({
    composition,
    serveUrl,
    output,
    frame,
    scale,
    imageFormat: "png",
    chromiumOptions: { gl: "angle" },
    browserExecutable,
    overwrite: true,
  });
  console.log(`${output}  ${Date.now() - t0}ms`);
}
