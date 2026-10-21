// Renders selected frames of compositions as PNG stills, reusing one bundle and browser.
// usage: node scripts/stills.mjs <outDir> <scale> <Comp:f1,f2,...> [<Comp:...> ...]
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const [outDir, scaleArg, ...specs] = process.argv.slice(2);
const scale = Number(scaleArg);
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = process.env.BUNDLE || (await bundle({ entryPoint: path.resolve("src/index.ts") }));
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.BROWSER || null,
  chromiumOptions: { gl: "angle" },
});
for (const spec of specs) {
  const [id, frames] = spec.split(":");
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, chromiumOptions: { gl: "angle" } });
  for (const f of frames.split(",").map(Number)) {
    const t0 = performance.now();
    const output = path.join(outDir, `${id}_${String(f).padStart(4, "0")}.png`);
    await renderStill({ composition, serveUrl, frame: f, output, scale, puppeteerInstance: browser, chromiumOptions: { gl: "angle" }, imageFormat: "png", timeoutInMilliseconds: 180000 });
    console.log(`${output} ${(performance.now() - t0).toFixed(0)}ms`);
  }
}
await browser.close({ silent: true });
