/**
 * Remotion CLI config. Applies to `npx remotion studio|render|still`.
 * (The Node.js render APIs ignore this file; pass the same options there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium. Equivalent to `--gl=angle` on the CLI.
Config.setChromiumOpenGlRenderer("angle");

// Lossless frames into the encoder, H.264 / yuv420p / CRF 16 out.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Use it if present; elsewhere
// this path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
