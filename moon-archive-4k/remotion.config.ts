/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
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
Config.setPixelFormat("yuv420p");
// The compositions draw with WebGL 2. ANGLE works on GPU and CPU-only
// (SwiftShader fallback) machines alike.
Config.setChromiumOpenGlRenderer("angle");
// WebGL frames at 4K are heavy; give slow CPU-only machines time.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it there;
// elsewhere Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
