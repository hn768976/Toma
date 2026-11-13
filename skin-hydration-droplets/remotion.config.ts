/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// Lossless intermediate frames (smooth skin gradients band easily in JPEG).
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setCrf(14);
// The compositions have no audio: write a video-only MP4 so the container
// duration is exactly frames / 30.
Config.setMuted(true);
// First frame compiles the shaders and bakes the procedural textures; give
// slow, GPU-less machines plenty of time for that.
Config.setDelayRenderTimeoutInMilliseconds(180000);
// The scenes are WebGL 2 shaders. On Linux (servers, CI, containers) the
// software ANGLE backend always works; on macOS / Windows ANGLE uses the GPU.
// Override on the command line with e.g. `--gl=angle` or `--gl=vulkan`.
Config.setChromiumOpenGlRenderer(process.platform === "linux" ? "swangle" : "angle");

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright one. Reuse it there; on a normal
// machine this path does not exist and Remotion uses its managed browser.
const sandboxBrowser =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(sandboxBrowser)) {
  Config.setBrowserExecutable(sandboxBrowser);
}
