/**
 * Remotion CLI configuration for the Voxel Brain Assembly project.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL through ANGLE on SwiftShader: works on any machine, GPU or not.
// On a machine with a GPU you can pass --gl=angle for faster renders.
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Tag and convert as BT.709 limited range (standard HD/UHD delivery).
Config.setColorSpace("bt709");
Config.setCrf(16);

// Sandboxed environments that block Remotion's own Chrome Headless Shell
// download can ship a Playwright headless shell at this path. On a normal
// machine it does not exist and Remotion uses its managed browser instead.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
