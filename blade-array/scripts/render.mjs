// Render one or more compositions to 1080p mp4 (compositions are 4K; --scale 0.5).
//   node scripts/render.mjs <scale> <frames|all> <id> [id ...]
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ALL } from "./ids.mjs";

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;

const scale = Number(process.argv[2]);
const frames = process.argv[3];
const ids = process.argv.slice(4);
const list = ids.length ? ids : ALL.map((c) => c.id);

mkdirSync(path.resolve("out"), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
console.log("bundled");

for (const id of list) {
  const row = ALL.find((c) => c.id === id);
  const composition = await selectComposition({
    serveUrl, id, inputProps: {}, browserExecutable, chromiumOptions: { gl: "swangle" },
  });
  if (frames !== "all") composition.durationInFrames = Number(frames);
  const output = path.resolve("out", `${row ? row.outName : id}.mp4`);
  const t0 = Date.now();
  await renderMedia({
    composition, serveUrl, codec: "h264", outputLocation: output,
    scale, crf: 16, pixelFormat: "yuv420p", imageFormat: "png",
    browserExecutable, chromiumOptions: { gl: "swangle" },
    concurrency: Number(process.env.CONC ?? 4), overwrite: true,
    // These are silent loops: no audio track at all, not a silent one.
    muted: true, enforceAudioTrack: false, audioCodec: null,
    timeoutInMilliseconds: 300000,
  });
  const secs = (Date.now() - t0) / 1000;
  console.log(`${output}  ${secs.toFixed(1)}s  ${(secs / composition.durationInFrames).toFixed(2)}s/frame`);
}
process.exit(0);
