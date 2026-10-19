/**
 * Remotion CLI config. Node.js APIs (renderMedia etc.) ignore this file.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames keep the pure black / #00FF00 backgrounds free of JPEG ringing
// before the final H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// Sandboxed environments that cannot download Remotion's Chrome Headless
// Shell can point at a local one. On a normal machine this path does not
// exist and Remotion uses its own managed browser.
const localHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(localHeadlessShell)) {
  Config.setBrowserExecutable(localHeadlessShell);
}
