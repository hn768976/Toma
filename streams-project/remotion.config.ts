import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Required for headless Chromium (no GPU → SwiftShader,
// with a GPU → the GPU). Equivalent CLI flag: --gl=angle
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium: reuse it. On a normal machine this
// path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
