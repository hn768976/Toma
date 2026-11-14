/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
Config.overrideBundlerConfig(enableTailwind);
// The compositions are WebGL2 shaders. "angle" uses the GPU when present and
// falls back to SwiftShader (CPU) on machines without one.
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Tag output as standard BT.709 limited range (yuv420p) for consistent colour
// across players.
Config.setColorSpace("bt709");

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright Chromium. Reuse it if present; elsewhere
// Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
