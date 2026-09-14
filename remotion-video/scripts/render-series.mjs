// Renders the microscopic-bacteria series.
//
// The eleven compositions are authored at 4K; this bundles once and
// renders every one of them at whatever scale it is asked for, so the
// 1080p deliverables and the 4K masters come off the same source with
// no second set of compositions to keep in sync.
//
//   node scripts/render-series.mjs out/1080p 0.5
//   node scripts/render-series.mjs out/4k     1
//
// A third argument renders only the named compositions:
//
//   node scripts/render-series.mjs out/1080p 0.5 Bacteria01ElectricCyan
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PRESET_IDS } from "./preset-ids.mjs";

const outDir = process.argv[2] ?? "out/1080p";
const scale = Number(process.argv[3] ?? 0.5);
const only = process.argv[4];

mkdirSync(outDir, { recursive: true });

// Some sandboxed environments block Remotion's own Chrome Headless
// Shell download but ship a Playwright Chromium; reuse it if present.
const headlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(headlessShell) ? headlessShell : null;

const ids = only ? only.split(",").map((s) => s.trim()) : PRESET_IDS;

console.log(`Bundling…`);
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  webpackOverride: enableTailwind,
});

const startedAll = Date.now();

for (const [index, id] of ids.entries()) {
  const composition = await selectComposition({
    serveUrl,
    id,
    inputProps: {},
    browserExecutable,
  });

  const output = path.join(outDir, `${id}.mp4`);
  const started = Date.now();
  let lastLogged = 0;

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: output,
    scale,
    // SwiftShader: there is no GPU in a headless render, so the whole
    // WebGL pipeline runs on the CPU.
    chromiumOptions: { gl: "swangle" },
    browserExecutable,
    concurrency: 4,
    jpegQuality: 95,
    crf: 17,
    timeoutInMilliseconds: 180000,
    inputProps: {},
    onProgress: ({ renderedFrames }) => {
      const now = Date.now();
      if (now - lastLogged < 30000) {
        return;
      }
      lastLogged = now;
      const elapsed = (now - started) / 1000;
      const rate = renderedFrames / Math.max(elapsed, 1);
      const remaining = (composition.durationInFrames - renderedFrames) / Math.max(rate, 0.001);
      console.log(
        `[${index + 1}/${ids.length}] ${id} ${renderedFrames}/${composition.durationInFrames} ` +
          `(${rate.toFixed(2)} fps, ~${Math.round(remaining / 60)}m left)`,
      );
    },
  });

  console.log(
    `[${index + 1}/${ids.length}] ${id} -> ${output} in ${((Date.now() - started) / 1000 / 60).toFixed(1)}m`,
  );
}

console.log(`All done in ${((Date.now() - startedAll) / 1000 / 60).toFixed(1)}m`);
