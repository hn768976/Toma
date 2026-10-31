/**
 * Remotion CLI configuration (applies to `npx remotion render|studio|still`).
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// WebGL 2 is required. "swangle" (ANGLE on SwiftShader, CPU) works on every
// machine including headless servers; on a workstation with a GPU you can
// pass `--gl=angle` on the command line for faster renders.
Config.setChromiumOpenGlRenderer("swangle");
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// may provide a Playwright build instead. On a normal machine this path does
// not exist and Remotion uses its own managed browser.
const fallbackShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(fallbackShell)) {
  Config.setBrowserExecutable(fallbackShell);
}
