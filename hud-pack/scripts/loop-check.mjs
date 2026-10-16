// Step 2 (loop seam): renders frames 0 and 600 of a 601-frame version of each loop
// (props {loopCheck:true}) and compares them pixel for pixel. Also renders 598/599 and
// compares the size of the 599->0 step with an ordinary 598->599 step (continuity).
// Step 3 (cold start): renders the middle frame on its own, in a fresh browser, and
// compares it byte for byte with the same frame from the full render (renders/frames).
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const mode = process.argv[2]; // "loop" | "cold"
const ids = process.argv.slice(3);
const scale = 0.3333333333333333;
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const out = "renders/checks";
fs.mkdirSync(out, { recursive: true });
const md5 = (f) => execFileSync("md5sum", [f]).toString().split(" ")[0];
const diff = (a, b) => {
  // mean absolute difference (0-255) via ffmpeg-free python
  return Number(execFileSync("python3", ["-I", "-c", `
import sys
from PIL import Image, ImageChops
a=Image.open(sys.argv[1]).convert('RGB'); b=Image.open(sys.argv[2]).convert('RGB')
d=ImageChops.difference(a,b); h=d.histogram()
tot=sum(i*c for k in range(3) for i,c in enumerate(h[k*256:(k+1)*256]))
print(tot/(a.size[0]*a.size[1]*3))`, a, b]).toString().trim());
};
for (const id of ids) {
  const comp = id.replace(/_/g, "-");
  if (mode === "loop") {
    const browser = await openBrowser("chrome", { browserExecutable: fs.existsSync(exe) ? exe : null, chromiumOptions: { gl: "angle" } });
    const inputProps = { id, loopCheck: true };
    const composition = await selectComposition({ serveUrl, id: comp, inputProps, puppeteerInstance: browser });
    const files = {};
    for (const f of [0, 598, 599, 600]) {
      const o = `${out}/${id}_loop_${f}.png`;
      await renderStill({ serveUrl, composition, frame: f, output: o, scale, imageFormat: "png", inputProps, puppeteerInstance: browser });
      files[f] = o;
    }
    await browser.close({ silent: true });
    const same = md5(files[0]) === md5(files[600]);
    const seam = diff(files[599], files[0]);
    const step = diff(files[598], files[599]);
    console.log(`${id} durationInFrames=${composition.durationInFrames} frame0==frame600: ${same ? "IDENTICAL" : "DIFFERENT"} | seam step 599->0 = ${seam.toFixed(3)} vs ordinary step 598->599 = ${step.toFixed(3)}`);
  } else {
    const browser = await openBrowser("chrome", { browserExecutable: fs.existsSync(exe) ? exe : null, chromiumOptions: { gl: "angle" } });
    const composition = await selectComposition({ serveUrl, id: comp, inputProps: { id }, puppeteerInstance: browser });
    const mid = Math.floor(composition.durationInFrames / 2);
    const o = `${out}/${id}_cold_${mid}.png`;
    await renderStill({ serveUrl, composition, frame: mid, output: o, scale, imageFormat: "png", inputProps: { id }, puppeteerInstance: browser });
    await browser.close({ silent: true });
    const dir = `renders/frames/${id}`;
    const ref = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort()[mid];
    const a = md5(o);
    const b = md5(path.join(dir, ref));
    console.log(`${id} middle frame ${mid}: cold-start ${a} vs full-render ${b} (${ref}) -> ${a === b ? "BYTE-IDENTICAL" : "DIFFERENT, mean abs diff " + diff(o, path.join(dir, ref)).toFixed(4)}`);
  }
}
