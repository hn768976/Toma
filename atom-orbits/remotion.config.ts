import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// three.js needs real WebGL2 in headless Chromium. "angle" works with or
// without a GPU (falls back to SwiftShader through ANGLE on CPU-only boxes).
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: JPEG would add banding/blocking to the dark
// gradients and could lift look 2's pure black.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// previews/masters carry no audio stream at all
Config.setMuted(true);
Config.setX264Preset("slow");
// x264 otherwise smooths the film grain away in the darkest blocks, which
// brings back banding in the navy / blue-green gradients. -tune grain keeps it.
Config.overrideFfmpegCommand(({ args }) => {
  const i = args.indexOf("libx264");
  if (i === -1 || args.includes("-tune")) return args;
  return [...args.slice(0, i + 1), "-tune", "grain", ...args.slice(i + 1)];
});
Config.setOverwriteOutput(true);
// Big stills (6000×3375) on a CPU-only (SwiftShader) machine can take well over
// the default 30 s per frame.
Config.setDelayRenderTimeoutInMilliseconds(300000);
Config.setEntryPoint("src/index.ts");

// Sandboxed environments that ship a Playwright Chromium instead of letting
// Remotion download its headless shell. On a normal machine this path does not
// exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
