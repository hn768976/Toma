// Render selected frames of a composition to PNG in one browser session.
// node scripts/frames.mjs <compId> <scale> <outDir> <start> <end> [everyNth] [propsJson]
import { renderFrames, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const [id, scaleArg, outDir, start, end, nth = "1", props = "{}"] = process.argv.slice(2);
const serveUrl = path.resolve(process.env.SERVE || "build");
const inputProps = JSON.parse(props);
fs.mkdirSync(outDir, { recursive: true });
const browser = await openBrowser("chrome", {
  browserExecutable: fs.existsSync("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
    ? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
    : null,
  chromiumOptions: { gl: "angle" },
});
const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser });
const t0 = Date.now();
let n = 0;
const stamps = [];
await renderFrames({
  composition,
  serveUrl,
  inputProps,
  puppeteerInstance: browser,
  outputDir: outDir,
  imageFormat: "png",
  scale: Number(scaleArg),
  frameRange: [Number(start), Number(end)],
  everyNthFrame: Number(nth),
  concurrency: Number(process.env.CONC || 2),
  chromiumOptions: { gl: "angle" },
  timeoutInMilliseconds: 180000,
  imageSequencePattern: "f[frame].[ext]",
  onStart: () => {},
  onFrameUpdate: () => { n++; stamps.push(Date.now()); },
});
const ms = Date.now() - t0;
// Steady-state cost: time between the first and last completed frame.
const steady = n > 1 ? Math.round((stamps[n - 1] - stamps[0]) / (n - 1)) : null;
console.log(JSON.stringify({ id, frames: n, ms, msPerFrame: Math.round(ms / Math.max(1, n)), steadyMsPerFrame: steady }));
await browser.close({ silent: true });
