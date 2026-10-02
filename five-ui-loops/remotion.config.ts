/**
 * Remotion CLI config. Applies to `npx remotion studio|render|still`.
 * (Node.js APIs ignore this file — pass the same options directly there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Headless Chromium has no WebGL without a GL backend;
// `--gl=angle` on the CLI does the same. On a machine with no GPU at all use
// `--gl=swangle` (SwiftShader behind ANGLE) instead.
Config.setChromiumOpenGlRenderer("angle");

// Lossless frames from the browser; banding/grain survive into the encoder.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Some sandboxes block Remotion's own Chrome Headless Shell download but ship
// a Playwright one. Use it when present; elsewhere Remotion downloads its own.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
