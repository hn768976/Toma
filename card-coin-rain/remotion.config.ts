/**
 * Remotion CLI config. Applies to `npx remotion render|still|studio`.
 * (The Node.js APIs ignore this file; pass the same options directly.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium. "angle" is the documented choice; on machines
// without a GPU Chromium falls back to SwiftShader through ANGLE.
Config.setChromiumOpenGlRenderer("angle");

// Lossless frames into the encoder: JPEG intermediates add their own
// blocking/banding on the smooth pastel backdrops.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed CI images sometimes block Remotion's own Chrome Headless Shell
// download but ship Playwright's. Use it when present; elsewhere Remotion
// falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
