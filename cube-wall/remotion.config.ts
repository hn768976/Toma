/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// "swangle" = ANGLE on top of SwiftShader (software WebGL 2). It works on
// headless servers without a GPU and gives identical output everywhere.
// On a machine with a GPU you can pass `--gl=angle` for faster renders.
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Reuse it when present; on a normal
// machine these paths don't exist and Remotion uses its managed browser.
const localShells = [
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-linux/headless_shell",
];
const localShell = localShells.find((p) => existsSync(p));
if (localShell) {
  Config.setBrowserExecutable(localShell);
}
