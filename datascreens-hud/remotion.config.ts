import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 via ANGLE. On a GPU-less machine Chromium falls back to SwiftShader.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setMuted(true); // no audio stream
// Keep the +-1/255 dither and the grain through H.264: without "tune grain"
// x264 smooths them away in flat gradients and the bands come back.
Config.overrideFfmpegCommand(({ args }) => {
  const i = args.indexOf("libx264");
  if (i === -1 || args.includes("-tune")) return args;
  return [...args.slice(0, i + 1), "-tune", "grain", ...args.slice(i + 1)];
});
Config.setOverwriteOutput(true);

// Sandboxed dev boxes that can't download Remotion's headless shell ship a
// Playwright one here. On a normal machine this path doesn't exist and
// Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
