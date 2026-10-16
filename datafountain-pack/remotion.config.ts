/**
 * Remotion CLI config. (Node.js render APIs ignore this file — pass the same
 * options directly there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
// WebGL2 through ANGLE. On a machine with a GPU this uses it; on a headless
// server without one, ANGLE falls back to SwiftShader (CPU) — same pixels,
// just slower. Equivalent CLI flag: --gl=angle
Config.setChromiumOpenGlRenderer("angle");
// Lossless frames into the encoder: JPEG intermediates would add blocking
// and destroy the dither that keeps the gradients from banding.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Out-of-order, multi-tab rendering is safe: every pixel is a pure function
// of the frame index.
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block downloading Remotion's managed Chrome
// Headless Shell but ship a Playwright one. Use it if present; on a normal
// machine this path does not exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
