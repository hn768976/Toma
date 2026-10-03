// Render specific frames of a composition to PNG with one bundle.
// usage: node scripts/stills.mjs <compId> <outDir> <scale> <frame,frame,...> [propsJson]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [id, outDir, scaleArg, framesArg, propsJson] = process.argv.slice(2);
const scale = Number(scaleArg);
const frames = framesArg.split(",").map(Number);
const inputProps = propsJson ? JSON.parse(propsJson) : {};
const headless = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(headless) ? headless : null;
const chromiumOptions = { gl: "angle" };

mkdirSync(outDir, { recursive: true });
const serveUrl = process.env.SERVE_URL ?? (await bundle({ entryPoint: path.resolve("src/index.ts") }));
const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable, chromiumOptions });
for (const frame of frames) {
  const t0 = Date.now();
  const output = path.join(outDir, `${id}_f${String(frame).padStart(3, "0")}.png`);
  await renderStill({ serveUrl, composition, frame, output, scale, inputProps, browserExecutable, chromiumOptions, imageFormat: "png", overwrite: true });
  console.log(`${output} ${Date.now() - t0}ms`);
}
