/**
 * Remotion CLI config. (Node.js APIs ignore this file — pass the same options
 * directly if you render programmatically.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Lossless PNG frames into the encoder: JPEG intermediates would add
// blocking and banding in the dark gradients.
Config.setVideoImageFormat("png");
Config.setStillImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// WebGL2 in headless Chromium: ANGLE is the reliable backend (looks 2–5).
Config.setChromiumOpenGlRenderer("angle");

// Large canvas textures (map dashboard) need time on software GL.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that ship a Playwright headless shell instead of
// letting Remotion download its own: reuse it. On a normal machine this path
// does not exist and Remotion uses its managed Chrome Headless Shell.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
