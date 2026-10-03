/**
 * Remotion CLI config. Applies to `npx remotion render|still|studio`.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Lossless intermediate frames: JPEG frames would add their own banding.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// WebGL2 through ANGLE in headless Chromium (looks 1, 3 and 5 need it).
Config.setChromiumOpenGlRenderer("angle");

// Generous timeout: fonts, the HDRI and the first shader compile all happen
// behind delayRender() and can be slow on software GL.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed machines block downloading Remotion's Chrome Headless Shell
// but ship a Playwright build at this path. Use it there; elsewhere Remotion
// downloads and manages its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
