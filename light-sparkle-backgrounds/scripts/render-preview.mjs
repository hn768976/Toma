// 720p preview pipeline for one or more compositions:
//   1. render all 600 frames as lossless PNGs (Remotion, --scale=1/3, GL=angle),
//      recording Remotion's per-frame render time;
//   2. encode H.264 / yuv420p / 30fps / CRF 16 with ffmpeg;
//   3. keep the frames the verify steps need (0, 300, contact sheet, 2s around 300).
// Usage: node scripts/render-preview.mjs [ids...]
import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ALL = ["SpotlightSparkles-Blue", "SpotlightSparkles-Gold", "PastelBokeh-PinkLavender", "PastelBokeh-MintAqua", "SunFlare-Midday", "SunFlare-GoldenHour", "StarTwinkle-Black", "SilkLight-PaleBlue"];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const SCALE = 0.3333333333333333;
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = fs.existsSync(exe) ? exe : undefined;
const chromiumOptions = { gl: "angle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const keep = new Set([0, 300, 0, 150, 300, 450, 599]);
for (let f = 270; f <= 330; f++) keep.add(f);

fs.mkdirSync("out/previews", { recursive: true });
fs.mkdirSync("out/stills", { recursive: true });
const timings = fs.existsSync("out/timings.json") ? JSON.parse(fs.readFileSync("out/timings.json", "utf8")) : {};

for (const id of ids) {
  const file = id.replace("-", "_");
  const composition = await selectComposition({ serveUrl, id, inputProps: {}, browserExecutable, chromiumOptions });
  const seqDir = path.join("out/seq", id);
  fs.rmSync(seqDir, { recursive: true, force: true });
  fs.mkdirSync(seqDir, { recursive: true });
  const perFrame = [];
  const t0 = Date.now();
  await renderFrames({
    composition,
    serveUrl,
    inputProps: {},
    outputDir: seqDir,
    imageFormat: "png",
    scale: SCALE,
    browserExecutable,
    chromiumOptions,
    onStart: () => {},
    onFrameUpdate: (_n, _f, ms) => perFrame.push(ms),
    onBrowserLog: (l) => { if (l.type === "error") console.log("[browser]", id, l.text); },
  });
  const wall = Date.now() - t0;
  const files = fs.readdirSync(seqDir).filter((f) => f.endsWith(".png")).sort();
  if (files.length !== 600) throw new Error(`${id}: expected 600 frames, got ${files.length}`);
  const pattern = files[0].replace(/\d+(?=\.png$)/, (m) => `%0${m.length}d`);
  const out = path.join("out/previews", `${file}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "30", "-i", path.join(seqDir, pattern),
    "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-r", "30", "-an", "-movflags", "+faststart", out]);
  // Keep the verification frames, drop the rest.
  const keepDir = path.join("out/frames", id);
  fs.rmSync(keepDir, { recursive: true, force: true });
  fs.mkdirSync(keepDir, { recursive: true });
  files.forEach((f, i) => { if (keep.has(i)) fs.copyFileSync(path.join(seqDir, f), path.join(keepDir, `f${String(i).padStart(3, "0")}.png`)); });
  fs.copyFileSync(path.join(seqDir, files[300]), path.join("out/stills", `${file}.png`));
  fs.rmSync(seqDir, { recursive: true, force: true });
  perFrame.sort((a, b) => a - b);
  const med = perFrame[Math.floor(perFrame.length / 2)];
  const mean = perFrame.reduce((a, b) => a + b, 0) / perFrame.length;
  timings[id] = { wallSeconds: wall / 1000, wallPerFrameMs: wall / 600, medianFrameMs: med, meanFrameMs: Math.round(mean) };
  fs.writeFileSync("out/timings.json", JSON.stringify(timings, null, 2));
  console.log(id, JSON.stringify(timings[id]));
}
