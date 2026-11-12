/**
 * Remotion CLI configuration.
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// WebGL2 via SwiftShader-backed ANGLE works on every machine, GPU or not.
// On a machine with a GPU you may pass --gl=angle for faster renders.
Config.setChromiumOpenGlRenderer("swangle");
Config.setConcurrency(2);

// Optional: reuse a locally installed Chromium instead of letting Remotion
// download its Chrome Headless Shell (useful in sandboxed/offline machines).
// Set REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell, or it will
// pick up a Playwright headless shell if one is installed at the path below.
import { existsSync } from "node:fs";
const localShell =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(localShell)) {
  Config.setBrowserExecutable(localShell);
}
