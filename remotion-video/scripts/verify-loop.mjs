// Proves both compositions loop: renders frame 0 and frame DURATION_IN_FRAMES
// of each and compares them pixel for pixel.
//
// Frame 210 is one past the composition's last frame, so it cannot be rendered
// through the CLI. Here the composition metadata is taken from the bundle and
// its duration nudged by one frame purely for the probe — the registered
// composition is untouched.
//
//   node scripts/verify-loop.mjs

import { existsSync, readFileSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const SHELL =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(SHELL) ? SHELL : null;

const IDS = ["HeadlineScroll", "HeadlineScrollLight"];

const serveUrl = await bundle({ entryPoint: "src/index.ts" });
let allSeamless = true;

for (const id of IDS) {
  const composition = await selectComposition({
    serveUrl,
    id,
    inputProps: {},
    browserExecutable,
  });
  const probe = {
    ...composition,
    durationInFrames: composition.durationInFrames + 1,
  };

  const outputs = [];
  for (const frame of [0, composition.durationInFrames]) {
    const output = `out/loop-${id}-${frame}.png`;
    await renderStill({
      composition: probe,
      serveUrl,
      output,
      frame,
      imageFormat: "png",
      browserExecutable,
    });
    outputs.push(output);
  }

  const [a, b] = outputs.map((file) => readFileSync(file));
  const identical = a.length === b.length && a.equals(b);
  allSeamless &&= identical;

  console.log(
    `${id}: frame 0 vs frame ${composition.durationInFrames} @ ` +
      `${composition.width}x${composition.height} — ` +
      (identical ? "IDENTICAL, loop is seamless" : "DIFFERENT, loop is broken"),
  );
}

process.exit(allSeamless ? 0 : 1);
