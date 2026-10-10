// Renders verification stills with one shared browser.
// usage: node scripts/verify.mjs <outDir> <comp> [comp...]
import { openBrowser, renderStill, selectComposition, renderFrames } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const [outDir, ...comps] = process.argv.slice(2);
const serveUrl = path.resolve("build");
const scale = 1 / 3;
const gl = process.env.REMOTION_GL ?? "angle";
const browserExecutable = fs.existsSync("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
  ? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" : null;
fs.mkdirSync(outDir, { recursive: true });
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions: { gl } });
const log = [];
for (const id of comps) {
  for (const loopCheck of [false, true]) {
    const inputProps = loopCheck ? { loopCheck: true } : {};
    const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser, chromiumOptions: { gl }, browserExecutable });
    const frames = loopCheck ? [0, 1, 599, 600] : [300, 0, 120, 240, 360, 480];
    for (const frame of frames) {
      const t0 = Date.now();
      await renderStill({ composition, serveUrl, frame, output: `${outDir}/${id}${loopCheck ? "_loop" : ""}_${frame}.png`, inputProps, scale, puppeteerInstance: browser, chromiumOptions: { gl }, browserExecutable, overwrite: true });
      log.push(`${id} ${loopCheck ? "loop " : ""}frame ${frame}: ${Date.now() - t0} ms`);
    }
  }
}
fs.writeFileSync(`${outDir}/still_times.txt`, log.join("\n") + "\n");
await browser.close({ silent: true });
console.log(log.join("\n"));
