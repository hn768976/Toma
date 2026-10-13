/**
 * Remotion CLI config. (Node.js render APIs ignore this file; pass the same
 * options to them directly.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Required for every composition in this project:
// three.js needs a real WebGL2 context in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames; the encoder does the only lossy step.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Some sandboxed environments ship a Playwright Chromium headless shell at
// this path and block Remotion's own browser download. Use it if present;
// elsewhere Remotion downloads and uses its managed Chrome Headless Shell.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}

// A 4K frame of Cloud Upload takes longer than Remotion's default 30 s
// per-frame timeout on software WebGL (no GPU). Generous limit; it does not
// change the output.
Config.setDelayRenderTimeoutInMilliseconds(600000);
