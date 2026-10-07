/**
 * Remotion CLI config. (The Node.js render APIs ignore this file — pass the
 * same options there directly.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Lossless intermediate frames: JPEG would add its own banding/blocking to the
// dark gradients before the H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// Every look is WebGL2. Headless Chromium must use ANGLE.
Config.setChromiumOpenGlRenderer("angle");
// Map rasterising + texture generation happen once per tab; give slow
// (software-GL) machines room.
Config.setDelayRenderTimeoutInMilliseconds(180000);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
// Silent compositions: no audio stream in the output.
Config.setMuted(true);
// Keep x264 from quantising the ±1/255 dither + grain away in near-black areas
// (which re-creates flat plateaus in dark vignette corners): add `-tune grain`
// to every libx264 encode.
Config.overrideFfmpegCommand(({ args }) => {
  const i = args.indexOf("libx264");
  if (i === -1 || args.includes("-tune")) return args;
  return [...args.slice(0, i + 1), "-tune", "grain", ...args.slice(i + 1)];
});

// Sandboxed environments that block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium: reuse it. On a normal machine this
// path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
