// All options: https://remotion.dev/docs/config
// When rendering through the Node APIs this file is ignored — pass the same
// options (chromiumOptions.gl = "angle") directly.
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// three.js on WebGL2 in headless Chromium: ANGLE is the reliable GL backend
// (falls back to SwiftShader when no GPU is present).
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// Heavy one-time texture builds (5k HUD canvas, 40k particle sets).
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that block downloading Remotion's Chrome Headless
// Shell may ship a Playwright one here. On a normal machine this path does not
// exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
