// Calibration harness: bundle once, then pull a colour still and a
// matte still from every composition in the series, so all eleven looks
// and their keys can be compared side by side without re-bundling.
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const outDir = process.argv[2];
const at = Number(process.argv[3] ?? 0.45); // fraction into each pass
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

const ids = (
  only
    ? only.split(",")
    : [
        "Bacteria01ElectricCyan",
        "Bacteria02VioletCluster",
        "Bacteria03PaleBlueSoftFocus",
        "Bacteria04SaturatedCobalt",
        "Bacteria05VioletMatte",
        "Bacteria06MagentaBloom",
        "Bacteria07GoldenField",
        "Bacteria08LavenderProbiotic",
        "Bacteria09BrightfieldGrey",
        "Bacteria10CrimsonSalmonella",
        "Bacteria11SteelTeal",
      ]
).map((s) => s.trim());

for (const id of ids) {
  const composition = await selectComposition({
    serveUrl,
    id,
    inputProps: {},
    browserExecutable,
  });
  const half = Math.round(composition.durationInFrames * 0.5);
  const passes = [
    ["colour", Math.floor(half * at)],
    ["matte", half + Math.floor((composition.durationInFrames - half) * at)],
  ];
  for (const [label, frame] of passes) {
    await renderStill({
      composition,
      serveUrl,
      output: path.join(outDir, `${id}.${label}.png`),
      frame,
      scale,
      chromiumOptions: { gl: "swangle" },
      browserExecutable,
      inputProps: {},
    });
  }
  console.log("done", id);
}
