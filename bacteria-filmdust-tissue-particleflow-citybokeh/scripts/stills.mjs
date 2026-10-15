// Render selected frames of selected compositions as PNGs with one bundle and
// one browser, timing each frame. Optional contact sheet per composition.
//
//   node scripts/stills.mjs --comps BacteriaChains_Red,FilmDust_Dense \
//        --frames 0,150,300,450,599 --scale 0.3333333333333333 --out renders/stills --sheet
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
    return acc;
  }, []),
);
const comps = String(args.comps).split(",");
const frames = String(args.frames ?? "300").split(",").map(Number);
const scale = Number(args.scale ?? 0.3333333333333333);
const out = path.resolve(String(args.out ?? "renders/stills"));
const inputProps = args.props ? JSON.parse(String(args.props)) : {};
mkdirSync(out, { recursive: true });

const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const serveUrl = args.bundle && existsSync(String(args.bundle))
  ? String(args.bundle)
  : await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome", {
  browserExecutable: existsSync(browserExecutable) ? browserExecutable : null,
  chromiumOptions: { gl: "angle" },
});
const timings = {};
for (const id of comps) {
  const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser });
  const files = [];
  timings[id] = [];
  for (const frame of frames) {
    const file = path.join(out, `${id}_f${String(frame).padStart(3, "0")}.png`);
    const t0 = performance.now();
    await renderStill({
      serveUrl, composition, frame, output: file, scale, imageFormat: "png", inputProps,
      puppeteerInstance: browser, chromiumOptions: { gl: "angle" }, overwrite: true,
      timeoutInMilliseconds: 600000,
    });
    const ms = performance.now() - t0;
    timings[id].push(Math.round(ms));
    files.push(file);
    console.log(`${id} frame ${frame}: ${ms.toFixed(0)} ms -> ${file}`);
  }
  if (args.sheet && files.length > 1) {
    const sheet = path.join(out, `${id}_sheet.png`);
    const inputs = files.flatMap((f) => ["-i", f]);
    const filter = files.map((_, i) => `[${i}]scale=640:-1[s${i}]`).join(";") + ";" +
      files.map((_, i) => `[s${i}]`).join("") + `hstack=inputs=${files.length}`;
    execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", filter, sheet]);
    console.log(`sheet -> ${sheet}`);
  }
}
console.log(JSON.stringify(timings));
await browser.close({ silent: true });
