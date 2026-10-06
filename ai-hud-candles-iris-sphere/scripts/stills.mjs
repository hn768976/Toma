// Render selected frames of a composition as PNG (one browser, one bundle).
// usage: node scripts/stills.mjs <compId> <outDir> <scale> <frame,frame,...> [gl]
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [id, outDir, scaleArg, framesArg, gl = "angle"] = process.argv.slice(2);
const scale = Number(scaleArg);
const frames = framesArg.split(",").map(Number);
mkdirSync(outDir, { recursive: true });
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const serveUrl = process.env.BUNDLE ?? (await bundle({ entryPoint: path.resolve("src/index.ts") }));
const browser = await openBrowser("chrome", {
  browserExecutable: existsSync(shell) ? shell : null,
  chromiumOptions: { gl },
});
const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, chromiumOptions: { gl } });
for (const frame of frames) {
  const t0 = Date.now();
  await renderStill({
    composition, serveUrl, frame, scale, puppeteerInstance: browser,
    output: path.join(outDir, `${id}_${String(frame).padStart(4, "0")}.png`),
    imageFormat: "png", chromiumOptions: { gl }, overwrite: true,
  });
  console.log(`frame ${frame}: ${Date.now() - t0} ms`);
}
await browser.close({ silent: true });
