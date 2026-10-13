/**
 * Remotion CLI config. (The Node APIs ignore this file; pass the same options there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Headless Chromium needs this; the default ("swangle"
// in some versions) can silently fall back to a slower path.
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames, so dark gradients are not JPEG-banded
// before the final H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed dev boxes sometimes block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one here. Elsewhere this path does not exist
// and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
