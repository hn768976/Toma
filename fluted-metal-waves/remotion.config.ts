/**
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// WebGL 2 is required. "swangle" = ANGLE on SwiftShader (software), works on
// machines without a GPU. On a workstation with a GPU you can pass --gl=angle.
Config.setChromiumOpenGlRenderer("swangle");

// Some sandboxed environments cannot download Remotion's Chrome Headless Shell
// but ship a Playwright one. Reuse it if present; otherwise Remotion uses its
// own managed browser as usual.
const sandboxBrowser =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(sandboxBrowser)) {
  Config.setBrowserExecutable(sandboxBrowser);
}
