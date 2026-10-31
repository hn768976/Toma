/**
 * Remotion CLI configuration.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Final deliverables: H.264 MP4, high quality.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// Standard limited-range BT.709 (tv range, tagged), the broadcast/web norm.
Config.setColorSpace("bt709");

// The compositions are WebGL 2 shaders. "swangle" (ANGLE on SwiftShader)
// renders identically on every machine, with or without a GPU. On a machine
// with a working GPU you can pass --gl=angle for faster renders.
Config.setChromiumOpenGlRenderer("swangle");

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright one. Reuse it when present; on a
// normal machine this path doesn't exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
