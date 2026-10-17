import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL2 through ANGLE. On a machine with a GPU this uses it; without one
// Chromium falls back to SwiftShader inside ANGLE.
Config.setChromiumOpenGlRenderer("angle");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
// Long first frames: the cloud noise volumes are built once per tab.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that ship a Playwright headless shell instead of
// letting Remotion download its own Chrome. Ignored elsewhere.
const pwShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pwShell)) {
  Config.setBrowserExecutable(pwShell);
}

// Keep the dither/grain in smooth gradients (skies, bokeh, dark falloffs):
// without this x264 flattens it at CRF 16 and 1-level steps reappear.
Config.overrideFfmpegCommand(({ type, args }) => {
  if (type !== "stitcher") return args;
  const i = args.indexOf("libx264");
  if (i === -1) return args;
  return [...args.slice(0, i + 1), "-tune", "grain", ...args.slice(i + 1)];
});
