// Render individual frames as PNG with one bundle and one browser.
//   node scripts/stills.mjs <compositionId> <outDir> <scale> <frames> [propsJson] [--cold] [--rebundle]
// <frames> is a comma list, e.g. 0,150,300. --cold opens a fresh browser for every frame.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [id, outDir, scaleArg, framesArg, propsArg] = args.filter((a) => !a.startsWith("--"));
const scale = Number(scaleArg);
const frames = framesArg.split(",").map(Number);
const inputProps = propsArg ? JSON.parse(propsArg) : {};
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const bundleDir = path.join(root, "out", "bundle");

const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(exe) ? exe : null;
const chromiumOptions = { gl: "angle" };

let serveUrl = bundleDir;
if (flags.has("--rebundle") || !existsSync(path.join(bundleDir, "index.html"))) {
  serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), outDir: bundleDir });
}
mkdirSync(outDir, { recursive: true });

const open = () => openBrowser("chrome", { browserExecutable, chromiumOptions });
let browser = await open();
const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser, chromiumOptions });
for (const frame of frames) {
  if (flags.has("--cold")) {
    await browser.close({ silent: true });
    browser = await open();
  }
  const t0 = performance.now();
  const output = path.join(outDir, `${id}_f${String(frame).padStart(4, "0")}.png`);
  await renderStill({
    composition,
    serveUrl,
    output,
    frame,
    scale,
    inputProps,
    imageFormat: "png",
    puppeteerInstance: browser,
    chromiumOptions,
    overwrite: true,
    timeoutInMilliseconds: 600000,
  });
  console.log(`${output}  ${((performance.now() - t0) / 1000).toFixed(2)}s`);
}
await browser.close({ silent: true });
