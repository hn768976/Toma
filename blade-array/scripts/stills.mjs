// Fast iteration + verification harness: bundle once, render many stills.
//   node scripts/stills.mjs <scale> <comp:frame> [comp:frame ...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;

const scale = Number(process.argv[2]);
const jobs = process.argv.slice(3).map((a) => {
  const [id, frame, out] = a.split(":");
  return { id, frame: Number(frame), out };
});

const outDir = path.resolve("out/stills");
mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
console.log("bundled");

for (const job of jobs) {
  const composition = await selectComposition({ serveUrl, id: job.id, inputProps: {}, browserExecutable, chromiumOptions: { gl: "swangle" } });
  const output = path.join(outDir, job.out ?? `${job.id}_f${job.frame}.png`);
  const t0 = Date.now();
  await renderStill({
    composition,
    serveUrl,
    output,
    frame: job.frame,
    scale,
    imageFormat: "png",
    browserExecutable,
    chromiumOptions: { gl: "swangle" },
    overwrite: true,
  });
  console.log(`${output}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
process.exit(0);
