/**
 * Remotion CLI configuration.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setRspack(true);
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
Config.overrideBundlerConfig(enableTailwind);

// The scene is drawn with Three.js / WebGL2. "swangle" (ANGLE + SwiftShader,
// CPU) works on any machine incl. headless servers without a GPU. On a
// machine with a GPU you can pass --gl=angle for faster renders.
Config.setChromiumOpenGlRenderer("swangle");

// H.264 MP4, 30 fps (fps is set on the compositions).
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Sandboxed environments that cannot download Remotion's Chrome Headless
// Shell may ship a Playwright one here. On a normal machine this path does
// not exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
