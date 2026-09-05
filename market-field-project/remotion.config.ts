/**
 * Note: when using the Node.js APIs this file does not apply — pass the same
 * options directly to the API instead. https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png"); // keeps the dark gradients out of a second lossy pass
Config.setOverwriteOutput(true);
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setMuted(true); // nothing here makes a sound; skip the silent audio track

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. On a normal
// machine the path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
