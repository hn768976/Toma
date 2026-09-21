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
const crf = Number(flag("crf", "16"));
const outDir = flag("out", "out/video");

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;

mkdirSync(outDir, { recursive: true });

const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), onProgress: () => {} });
console.log(`bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const comps = await getCompositions(serveUrl, { browserExecutable });
const targets = comps.filter((c) => ids.length === 0 || ids.includes(c.id));

const timings = [];
for (const comp of targets) {
  const file = comp.props?.look?.file ?? comp.id;
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
    // The references include one clip with an audio track; ours must not.
    enforceAudioTrack: false,
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
    width: Math.round(comp.width * scale),
    height: Math.round(comp.height * scale),
  });
  console.log(`${comp.id} -> ${output}  ${(ms / 1000 / 60).toFixed(1)}min  ${perFrame.toFixed(2)}s/frame`);
  writeFileSync("out/render-timings.json", JSON.stringify(timings, null, 2));
}

console.log(`\nall done in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`);
