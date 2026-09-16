// Renders every version to a 1080p H.264 MP4.
//
// The compositions are authored at 3840x2160; --scale 0.5 renders them at
// exactly half that, so the delivered files are true 1920x1080 frames of the
// same 4K project rather than a separate set of half-size compositions.
// Drop the scale (or pass 1) to render the 4K masters instead.

import { bundle } from "@remotion/bundler";
import { enableTailwind } from "@remotion/tailwind-v4";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const outDir = process.argv[2] ?? "out/1080p";
const scale = Number(process.argv[3] ?? 0.5);
// Comma-separated list, so a subset can be re-rendered without touching the rest.
const only = process.argv[4] ? process.argv[4].split(",").map((v) => v.trim()) : null;
// Quality is uniform across the set by default. V03 is the densest scene and
// encodes largest, so it can be given a slightly higher CRF when a delivery
// channel imposes a size ceiling - re-rendering at a new CRF rather than
// transcoding the finished file avoids a second generation of h264 loss.
const crf = Number(process.env.CRF ?? 16);

const headlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(headlessShell) ? headlessShell : null;

mkdirSync(outDir, { recursive: true });

console.log("bundling...");
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  webpackOverride: enableTailwind,
});

// Listed explicitly rather than imported: versions.ts is TypeScript and this
// script runs as plain Node.
const ids = [
  "V01Halo",
  "V02Projection",
  "V03Fibers",
  "V04Pedestal",
  "V05Flythrough",
  "V06Amber",
  "V07Hud",
  "V08Chevron",
  "V09Assembly",
].filter((id) => !only || only.includes(id));

const started = Date.now();
for (const id of ids) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  const output = path.join(outDir, `${id}.mp4`);
  const t0 = Date.now();
  let lastLogged = -1;

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    // The references carry no audio and none is wanted here. Left alone,
    // Remotion attaches a silent AAC track, which also pushed the container
    // past the intended length (25.046s rather than 25.000s).
    muted: true,
    enforceAudioTrack: false,
    // PNG frames rather than JPEG. JPEG intermediates come through as full
    // range and the encoder tags the result yuvj420p; PNG yields a clean
    // limited-range yuv420p, which is what a delivery H.264 should be.
    imageFormat: "png",
    outputLocation: output,
    browserExecutable,
    scale,
    crf,
    pixelFormat: "yuv420p",
    concurrency: 4,
    overwrite: true,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= lastLogged + 20) {
        lastLogged = pct;
        process.stdout.write(`  ${id} ${pct}%\n`);
      }
    },
  });

  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(
    `${id}: ${composition.width * scale}x${composition.height * scale}, ` +
      `${composition.durationInFrames} frames, ${secs}s -> ${output}`,
  );
}
console.log(`all done in ${((Date.now() - started) / 60000).toFixed(1)} min`);
