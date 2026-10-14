/**
 * Remotion CLI config. (Node.js render APIs ignore this file; pass the same
 * options there directly.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. On a machine with a GPU this is hardware-accelerated.
// Override per run with --gl=swangle on a GPU-less box if angle is unavailable.
Config.setChromiumOpenGlRenderer("angle");

// PNG frames into the encoder: no JPEG artefacts before H.264.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright one; reuse it when present.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
