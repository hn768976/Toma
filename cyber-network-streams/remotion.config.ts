/**
 * Remotion CLI config. (Node.js render APIs ignore this file; pass the same
 * options directly there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Required for looks 1–5 in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames so dark gradients don't band before encoding.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setX264Preset("slow");

// Black-safe H.264: with x264's default fast P-skip, stale chroma left in
// skipped blocks put values of 2–4 into the pure-black areas of Fibre Strands
// and the HUD. aq-mode 3 (dark-biased AQ) plus fast-pskip=0 keeps empty areas at
// 0–1 and also helps the dark gradients.
const X264_PARAMS = "aq-mode=3:aq-strength=1.6:fast-pskip=0";
Config.overrideFfmpegCommand(({ args }) => {
  // applies to whichever pass encodes H.264 (Remotion encodes in the pre-stitcher)
  if (!args.includes("libx264") || args.includes("-x264-params")) return args;
  const out = args[args.length - 1];
  return [...args.slice(0, -1), "-x264-params", X264_PARAMS, out];
});
Config.setOverwriteOutput(true);
// The pieces are silent: no audio stream in the output.
Config.setMuted(true);
Config.setConcurrency(1);

// Sandboxed environments that ship a Playwright Chromium: reuse it rather
// than downloading Remotion's Chrome Headless Shell. On other machines the
// path doesn't exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
