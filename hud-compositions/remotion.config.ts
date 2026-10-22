/**
 * Remotion CLI configuration for the HUD compositions.
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Tag and encode as BT.709 limited range (standard for HD/UHD delivery).
Config.setColorSpace("bt709");

// SatelliteTargeting renders its terrain with WebGL2 and WorldTracking draws
// a large Canvas 2D map every frame. The "swiftshader" CPU backend runs both
// on any machine and was measured ~6x faster than "swangle" for the Canvas 2D
// work. Set REMOTION_GL=angle to use a hardware GPU where one is available.
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as "angle" | "swangle" | "swiftshader" | undefined) ??
    "swiftshader",
);

// Sandboxed environments sometimes block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright Chromium. Reuse it when it
// exists; on a normal machine Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
