// Applies to the CLI (studio, render, still). See README for the 4K commands.
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setMuted(true); // no audio stream
// WebGL2 via ANGLE: required for Coin Badge (three.js) and Particle Wave (PixiJS)
// in headless Chromium. Same as passing --gl=angle on the command line.
Config.setChromiumOpenGlRenderer("angle");
Config.setChromiumMultiProcessOnLinux(true);

// Some sandboxed environments ship a Playwright headless shell instead of
// letting Remotion download its own. Use it when present; elsewhere Remotion
// falls back to its managed Chrome Headless Shell.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
