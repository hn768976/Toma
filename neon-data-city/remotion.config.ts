/**
 * Note: when rendering through the Node APIs this file is ignored — pass the
 * same options directly instead.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// The bars clip to white on purpose; keep the encoder from smearing them.
Config.setCrf(16);
// WebGL scenes must render one frame at a time per browser tab.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Reuse it there; on a normal machine
// this path does not exist and Remotion falls back to its managed browser.
for (const candidate of [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
]) {
  if (existsSync(candidate)) {
    Config.setBrowserExecutable(candidate);
    break;
  }
}
