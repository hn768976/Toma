// Renders the 720p previews (or 4K masters with --scale=1) of the 8 clips.
//
//   GL=swangle node scripts/render-previews.mjs [--scale=0.3333333333333333] [--concurrency=4] [ids...]
//
// Frames are rendered losslessly (PNG) with Remotion, then encoded with
// ffmpeg to H.264 / yuv420p / CRF 16 / 30fps. Loops are rendered with 601
// frames (frame 600 is only used for the loop check, the mp4 has 600).
import { getCompositions, renderFrames, renderStill } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ROOT, browserExecutable, chromiumOptions, makeBundle } from "./common.mjs";

export const CLIPS = [
  { id: "WatercolourBloom-Pastel", out: "WatercolourBloom_Pastel", loop: true },
  { id: "WatercolourBloom-Sunset", out: "WatercolourBloom_Sunset", loop: true },
  { id: "InkReveal-Indigo", out: "InkReveal_Indigo", loop: false },
  { id: "InkReveal-Sepia", out: "InkReveal_Sepia", loop: false },
  { id: "SketchyDrift-KidsBright", out: "SketchyDrift_KidsBright", loop: true },
  { id: "SketchyDrift-Muted", out: "SketchyDrift_Muted", loop: true },
  { id: "HatchedMap-Antique", out: "HatchedMap_Antique", loop: true },
  { id: "Chalkboard-Green", out: "Chalkboard_Green", loop: true },
];

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=")[1] : d;
};
const scale = Number(opt("scale", String(1 / 3)));
const concurrency = Number(opt("concurrency", "4"));
const only = args.filter((a) => !a.startsWith("--"));
const outRoot = path.join(ROOT, opt("out", "renders"));
mkdirSync(outRoot, { recursive: true });
const resultsFile = path.join(outRoot, "results.json");
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, "utf8")) : {};

const serveUrl = await makeBundle();
const pad = (n) => String(n).padStart(3, "0");

for (const clip of CLIPS.filter((c) => only.length === 0 || only.includes(c.id) || only.includes(c.out))) {
  const inputProps = clip.loop ? { loopCheck: true } : {};
  const comps = await getCompositions(serveUrl, { browserExecutable, chromiumOptions, inputProps });
  const composition = comps.find((c) => c.id === clip.id);
  const dir = path.join(outRoot, clip.out);
  const framesDir = path.join(dir, "frames");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const perFrame = [];
  const t0 = Date.now();
  await renderFrames({
    composition,
    serveUrl,
    inputProps,
    outputDir: framesDir,
    imageFormat: "png",
    scale,
    concurrency,
    browserExecutable,
    chromiumOptions,
    timeoutInMilliseconds: 600_000,
    onStart: () => {},
    onFrameUpdate: (done, _frame, ms) => {
      perFrame.push(ms);
      if (done % 60 === 0) console.log(`${clip.out}: ${done}/${composition.durationInFrames}`);
    },
  });
  const wall = (Date.now() - t0) / 1000;
  const n = clip.loop ? 600 : composition.durationInFrames;
  const mp4 = path.join(outRoot, `${clip.out}.mp4`);
  const enc = (frames, file) =>
    execFileSync("ffmpeg", [
      "-v", "error", "-y", "-framerate", "30", "-start_number", "0",
      "-i", path.join(framesDir, "element-%03d.png"),
      "-frames:v", String(frames),
      "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int",
      "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
      "-r", "30", "-an", "-movflags", "+faststart", file,
    ]);
  enc(n, mp4);
  if (clip.loop) enc(601, path.join(dir, `${clip.out}_601.mp4`));
  const sorted = [...perFrame].sort((a, b) => a - b);
  results[clip.out] = {
    id: clip.id,
    frames: composition.durationInFrames,
    scale,
    concurrency,
    wallSeconds: wall,
    wallPerFrameMs: (wall * 1000) / composition.durationInFrames,
    medianFrameMs: sorted[Math.floor(sorted.length / 2)],
  };
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`${clip.out}: ${composition.durationInFrames} frames in ${wall.toFixed(0)}s`);

  // determinism: cold-start the middle frame in a fresh browser and compare bytes
  const mid = Math.floor(n / 2);
  const cold = path.join(dir, `cold_${pad(mid)}.png`);
  await renderStill({ composition, serveUrl, inputProps, output: cold, frame: mid, scale, imageFormat: "png", browserExecutable, chromiumOptions, timeoutInMilliseconds: 600_000 });
  const same = readFileSync(cold).equals(readFileSync(path.join(framesDir, `element-${pad(mid)}.png`)));
  results[clip.out].determinism = { frame: mid, byteIdentical: same };
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`${clip.out}: cold-start frame ${mid} byte-identical: ${same}`);
}
