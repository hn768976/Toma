/**
 * Remotion CLI config. (The Node.js render APIs ignore this file; pass the
 * same options to them directly.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Every frame must be lossless before encoding: the banding and black-level
// checks read real pixel values.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// WebGL2 in headless Chromium: ANGLE is the reliable backend.
// Same as passing --gl=angle on the command line.
Config.setChromiumOpenGlRenderer("angle");

// Each frame of these compositions is heavy (4K canvases, 120k particles);
// give slow machines room before Remotion gives up on a frame.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that block Remotion's own Chrome Headless Shell
// download often ship a Playwright Chromium. Reuse it when present;
// elsewhere Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
