// Dev helper: render a few stills of one composition with a single bundle +
// browser, and print the time per frame.
//   node scripts/stills.mjs <compId> <outDir> <frame,frame,...> [scale] [--rebundle]
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [id, outDir, framesArg, scaleArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const propsArg = process.argv.find((a) => a.startsWith("--props="));
const inputProps = propsArg ? JSON.parse(propsArg.slice(8)) : {};
const scale = Number(scaleArg ?? 1 / 3);
const frames = framesArg.split(",").map(Number);
const bundleDir = path.resolve("build/bundle");
if (!existsSync(bundleDir) || process.argv.includes("--rebundle")) {
  await bundle({ entryPoint: path.resolve("src/index.ts"), outDir: bundleDir, publicDir: path.resolve("public") });
}
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browser = await openBrowser("chrome", {
  browserExecutable: existsSync(pw) ? pw : null,
  chromiumOptions: { gl: "angle" },
});
const composition = await selectComposition({ serveUrl: bundleDir, id, puppeteerInstance: browser, inputProps });
mkdirSync(outDir, { recursive: true });
for (const frame of frames) {
  const t0 = Date.now();
  await renderStill({
    composition, serveUrl: bundleDir, frame, scale, imageFormat: "png", inputProps,
    output: path.join(outDir, `${id}_${String(frame).padStart(3, "0")}.png`),
    puppeteerInstance: browser, timeoutInMilliseconds: 180000,
    onBrowserLog: (l) => { if (process.env.LOGS && !/GPU stall|GroupMarker/.test(l.text)) console.log("[browser]", l.type, l.text.slice(0, 2000)); },
    chromiumOptions: { gl: "angle" }, logLevel: process.env.LOGS ? "verbose" : "info",
  });
  console.log(`${id} frame ${frame}: ${((Date.now() - t0) / 1000).toFixed(2)} s`);
}
await browser.close({ silent: true });
