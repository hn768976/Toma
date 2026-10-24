/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// The scenes are WebGL 2 (Three.js). ANGLE works on GPU and GPU-less machines.
Config.setChromiumOpenGlRenderer("angle");
// Encoding defaults for deliverables: H.264 MP4, high quality.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// Software-GL renders are CPU-bound; two tabs balance throughput and memory.
Config.setConcurrency(2);
// A 4K frame with depth of field can take a while on GPU-less machines.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright one at this path. Reuse it when present;
// elsewhere Remotion downloads and uses its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
