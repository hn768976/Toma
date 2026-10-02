/**
 * Remotion CLI config. Applies to `npx remotion render|still|studio`.
 * See https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames: lossless intermediate, so the pure black of EquationFlight_Black
// and the smooth gradients reach the encoder untouched (JPEG would add blocking).
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setMuted(true);
// SwiftShader measured ~2x faster than swangle for these filter-heavy scenes
// on a 4-core CPU-only machine. Keep the same renderer for every render so
// frames match across runs.
Config.setChromiumOpenGlRenderer("swiftshader");

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Use it when it
// exists; on a normal machine Remotion downloads its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
