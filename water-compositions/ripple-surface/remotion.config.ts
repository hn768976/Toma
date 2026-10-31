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

// The compositions are WebGL 2 fragment shaders. "angle" uses the GPU when
// one is present and falls back to SwiftShader (software) on headless
// servers without a GPU, so rendering works everywhere.
Config.setChromiumOpenGlRenderer("swangle");

// Deliverables: H.264 MP4, high quality.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setX264Preset("slow");

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright build. Reuse it when present; on a
// normal machine this path doesn't exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
