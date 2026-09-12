/**
 * Render configuration. When rendering through the Node APIs instead of the
 * CLI, these options have to be passed to the API calls directly.
 * https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Constant rate factor: 17 keeps the thin 1px HUD strokes and small type
// free of mosquito noise without ballooning the file size.
Config.setCrf(17);
// Motion graphics only — no silent audio track riding along in the MP4.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);
// Tag the stream bt709 limited-range so editors and players read the levels
// the same way; JPEG frames alone would land as full-range yuvj420p.
Config.setColorSpace("bt709");

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Reuse that one when it is present; on a
// normal machine the path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
