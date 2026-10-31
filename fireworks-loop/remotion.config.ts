/**
 * Remotion CLI configuration.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("png"); // lossless intermediate frames -> no double compression
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setChromiumOpenGlRenderer("swangle");

// Offline/sandboxed machines can't download Remotion's managed Chrome Headless
// Shell. If a Playwright headless shell is present, reuse it; otherwise Remotion
// falls back to downloading its own browser as usual.
const candidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE ?? "",
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
];
const found = candidates.find((p) => p && existsSync(p));
if (found) {
  Config.setBrowserExecutable(found);
}
