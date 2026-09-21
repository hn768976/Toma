/**
 * Render every composition once, from a single bundle.
 *
 *   node scripts/render-all.mjs [--scale=0.5] [--concurrency=2] [ids...]
 *
 * Compositions are defined at 3840x2160; --scale=0.5 gives the 1920x1080
 * preview deliverable. Per-composition timings are written to
 * out/render-timings.json for the report.
 */
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=")[1];
const ids = args.filter((a) => !a.startsWith("--"));
const scale = Number(flag("scale", "0.5"));
const concurrency = Number(flag("concurrency", "2"));
const crfOverride = args.some((a) => a.startsWith("--crf="))
  ? Number(flag("crf", "16"))
  : null;
const outDir = flag("out", "out/video");

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;

mkdirSync(outDir, { recursive: true });

const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), onProgress: () => {} });
console.log(`bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const comps = await getCompositions(serveUrl, { browserExecutable });
const targets = comps.filter((c) => ids.length === 0 || ids.includes(c.id));

/**
 * Keep the dither through the encoder.
 *
 * The grain pass puts real per-pixel noise in the frame -- a lossless still
 * off this project shows 83% of pixels differing from their left neighbour.
 * x264 then throws most of it away in flat regions, because fine noise is
 * exactly the low-energy high-frequency content its quantiser discards, and
 * the near-white field of look 5 came back with visible contour steps.
 *
 * `-tune grain` raises the quantiser's tolerance for that noise. Measured on
 * look 5 at CRF 12: 22 stepped plateaus on a scanline down to 2, and the
 * longest identical run from 187px to 84px.
 */
const tuneForGrain = ({ args }) => {
  const out = [...args];
  const crfIndex = out.indexOf("-crf");
  const at = crfIndex >= 0 ? crfIndex + 2 : Math.max(0, out.length - 1);
  out.splice(at, 0, "-tune", "grain");
  return out;
};

const timings = [];
for (const comp of targets) {
  const look = comp.props?.look;
  const file = look?.file ?? comp.id;
  // Each look carries its own quality setting; --crf overrides all of them.
  const crf = crfOverride ?? look?.post?.crf ?? 16;
  const output = path.join(outDir, `${file}.mp4`);
  const start = Date.now();
  let lastLogged = 0;

  await renderMedia({
    composition: comp,
    serveUrl,
    codec: "h264",
    pixelFormat: "yuv420p",
    crf,
    imageFormat: "png",
    scale,
    concurrency,
    outputLocation: output,
    browserExecutable,
    chromiumOptions: { gl: "angle" },
    timeoutInMilliseconds: 300000,
    overwrite: true,
    ffmpegOverride: tuneForGrain,
    // The references include one clip with an audio track; ours must not.
    // `enforceAudioTrack: false` only stops Remotion FORCING one -- it still
    // muxes a silent AAC track. `muted` is what omits audio entirely.
    enforceAudioTrack: false,
    muted: true,
    onProgress: ({ renderedFrames }) => {
      if (renderedFrames - lastLogged >= 100) {
        lastLogged = renderedFrames;
        const per = (Date.now() - start) / 1000 / Math.max(1, renderedFrames);
        console.log(`  ${comp.id} ${renderedFrames}/${comp.durationInFrames}  ${per.toFixed(2)}s/frame`);
      }
    },
  });

  const ms = Date.now() - start;
  const perFrame = ms / 1000 / comp.durationInFrames;
  timings.push({
    id: comp.id,
    file,
    seconds: +(ms / 1000).toFixed(1),
    secondsPerFrame: +perFrame.toFixed(3),
    crf,
    width: Math.round(comp.width * scale),
    height: Math.round(comp.height * scale),
  });
  console.log(`${comp.id} -> ${output}  ${(ms / 1000 / 60).toFixed(1)}min  ${perFrame.toFixed(2)}s/frame`);
  writeFileSync("out/render-timings.json", JSON.stringify(timings, null, 2));
}

console.log(`\nall done in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`);
