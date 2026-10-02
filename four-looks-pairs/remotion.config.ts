/**
 * Applies to the CLI (`npx remotion render|still|studio`).
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium. Same as passing `--gl=angle` on the CLI.
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: grain and soft gradients survive into the encoder.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// Video only: no (silent) audio stream in the mp4.
Config.setMuted(true);
Config.setOverwriteOutput(true);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium here. On a normal machine
// this path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
