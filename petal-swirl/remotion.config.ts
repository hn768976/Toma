/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// "swangle" (SwiftShader via ANGLE) works on any machine, GPU or not.
// On a machine with a GPU you may pass --gl=angle for faster renders.
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Software WebGL can be slow on the first frame; allow generous time.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Sandboxed environments that block downloading Remotion's own Chrome
// Headless Shell may ship a Playwright one; reuse it if present. On a
// normal machine this path does not exist and Remotion uses its default.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
