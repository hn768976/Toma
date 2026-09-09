/**
 * Note: when using the Node.JS APIs this file does not apply; pass options
 * directly to the APIs instead.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// The piece is flat colour and type: 4:2:0 is fine, and yuv420p is what makes
// the file play everywhere.
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Use it there; on a normal machine this
// path won't exist and Remotion falls back to its managed browser.
const playwrightShells = [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium/chrome-linux/headless_shell",
];
const shell = playwrightShells.find((p) => existsSync(p));
if (shell) {
  Config.setBrowserExecutable(shell);
}
