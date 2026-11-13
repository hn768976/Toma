/**
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
// Standard limited-range BT.709 output (tagged), as expected by players/editors.
Config.setColorSpace("bt709");
// WebGL scene: SwiftShader-over-ANGLE works everywhere, including GPU-less
// servers/containers. On a machine with a GPU you may pass --gl=angle to speed up.
Config.setChromiumOpenGlRenderer("swangle");
Config.setDelayRenderTimeoutInMilliseconds(180000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// may ship a Playwright one; use it when present, otherwise Remotion's default.
const localHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(localHeadlessShell)) {
  Config.setBrowserExecutable(localHeadlessShell);
}
