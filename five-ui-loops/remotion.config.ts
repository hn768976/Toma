/**
 * Remotion CLI config. Applies to `npx remotion studio|render|still`.
 * (Node.js APIs ignore this file — pass the same options directly there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Headless Chromium has no WebGL without a GL backend;
// `--gl=angle` on the CLI does the same. On a machine with no GPU at all use
// `--gl=swangle` (SwiftShader behind ANGLE) instead.
Config.setChromiumOpenGlRenderer("angle");

// Lossless frames from the browser; banding/grain survive into the encoder.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Previews and 4K masters carry no audio stream.
Config.setMuted(true);

// Grain-preserving x264 settings. The looks carry ~2-4% fine grain + ±1/255
// dither against banding; default x264 settings smooth that away in deep
// shadows (looks 1 and 3) and plateaus reappear. Keep it: tune=grain, no
// deadzones, no DCT decimation, dark-biased adaptive quantisation.
Config.overrideFfmpegCommand(({ args }) => {
  const i = args.indexOf("libx264");
  if (i === -1) return args;
  return [
    ...args.slice(0, i + 1),
    "-tune",
    "grain",
    "-x264-params",
    "aq-mode=3:deadzone-inter=0:deadzone-intra=0:no-dct-decimate=1",
    ...args.slice(i + 1),
  ];
});

// Some sandboxes block Remotion's own Chrome Headless Shell download but ship
// a Playwright one. Use it when present; elsewhere Remotion downloads its own.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
