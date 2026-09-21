/**
 * Stills harvest: 4 well-separated frames per composition at 6000x3375.
 *
 * The colour sweep moves the image substantially over the loop, so frames 120
 * apart read as genuinely different pictures - forty images for ten renders.
 *   node scripts/stills-export.mjs [id ...]
 */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ALL } from "./ids.mjs";

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const chromiumOptions = { gl: "swangle" };

/** 6000 / 3840. Gives 6000x3375 from the 4K composition. */
const SCALE = 6000 / 3840;
const FRAMES = [30, 180, 330, 480];

const ids = process.argv.slice(2);
const list = ids.length ? ALL.filter((c) => ids.includes(c.id)) : ALL;
const outDir = path.resolve("out/stills-6k");
mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
for (const row of list) {
  const composition = await selectComposition({
    serveUrl, id: row.id, inputProps: {}, browserExecutable, chromiumOptions,
  });
  for (const frame of FRAMES) {
    const output = path.join(outDir, `${row.outName}_f${frame}.png`);
    const t0 = Date.now();
    await renderStill({
      composition, serveUrl, output, frame, scale: SCALE, imageFormat: "png",
      browserExecutable, chromiumOptions, overwrite: true, timeoutInMilliseconds: 300000,
    });
    console.log(`${output}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
process.exit(0);
