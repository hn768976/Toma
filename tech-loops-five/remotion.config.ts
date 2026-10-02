/**
 * Remotion CLI config for the Tech Loops project.
 * (When using the Node APIs this file does not apply — pass the same
 * options directly, see scripts/render-previews.mjs.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames: lossless intermediates, so the byte-for-byte determinism
// checks compare exactly what the browser drew.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Look 5 (AI Core Tunnel) needs WebGL2. Headless Chromium only exposes it
// with the ANGLE backend, so make it the project default (same as passing
// --gl=angle on the command line).
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one at this path. On a normal machine the path
// won't exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
