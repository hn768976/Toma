/**
 * Remotion CLI config. Applies to `npx remotion render|still|studio`.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setOverwriteOutput(true);

// WebGL shader compilation can be slow on software GL; give each tab time.
Config.setDelayRenderTimeoutInMilliseconds(180000);

// Looks 1 and 2 are WebGL2 (react-three-fiber). Headless Chromium needs an
// explicit GL backend: "angle" (ANGLE, uses the GPU when there is one and
// falls back to SwiftShader when there isn't).
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: PNG, not JPEG, so dark gradients don't pick
// up JPEG blocking before the H.264 encode.
Config.setVideoImageFormat("png");

// H.264, yuv420p, CRF 16 for every mp4.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Some sandboxed environments can't download Remotion's own headless shell
// but ship a Playwright one. Use it if it's there; otherwise Remotion uses
// its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
