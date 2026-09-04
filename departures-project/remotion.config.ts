/**
 * Note: when using the Node.JS APIs, this config file does not apply.
 * Pass the options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames rather than JPEG: the whole product is crisp small type, and
// JPEG's chroma subsampling softens it before the encoder ever sees it.
Config.setVideoImageFormat("png");
Config.setStillImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
// Neither board has sound, so don't attach a silent audio track.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
Config.setOverwriteOutput(true);

// Some sandboxed CI/dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it there.
// On a normal machine this path does not exist and Remotion falls back to its
// default managed browser, so this block is a no-op.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
