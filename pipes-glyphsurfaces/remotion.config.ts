import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE is the reliable GL path in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Sandboxed environments that block Remotion's browser download but ship a
// Playwright headless shell: reuse it. Elsewhere Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
