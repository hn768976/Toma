// Calibration harness: bundle once, then pull one frame from every
// composition in the series, so all eleven looks and their keys can be
// compared side by side without re-bundling each time.
//
//   node scripts/stills.mjs out/bacteria-stills 0.45 0.5
//
// The third argument is how far into the clip to sample (0-1); a fourth
// renders only the named compositions.
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PRESET_IDS } from "./preset-ids.mjs";

const outDir = process.argv[2] ?? "out/bacteria-stills";
const at = Number(process.argv[3] ?? 0.45);
const scale = Number(process.argv[4] ?? 0.5);
const only = process.argv[5];

mkdirSync(outDir, { recursive: true });

const headlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(headlessShell) ? headlessShell : null;

const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  webpackOverride: enableTailwind,
});

const ids = only ? only.split(",").map((s) => s.trim()) : PRESET_IDS;

for (const id of ids) {
  const composition = await selectComposition({
    serveUrl,
    id,
    inputProps: {},
    browserExecutable,
  });
  await renderStill({
    composition,
    serveUrl,
    output: path.join(outDir, `${id}.png`),
    frame: Math.floor(composition.durationInFrames * at),
    scale,
    chromiumOptions: { gl: "swangle" },
    browserExecutable,
    inputProps: {},
  });
  console.log("done", id);
}
