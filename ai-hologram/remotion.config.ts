import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

/**
 * Note: when using the Node APIs this file does not apply — pass the same
 * options directly to renderMedia().
 */
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Use it there; on a normal machine
// this path does not exist and Remotion falls back to its managed browser.
const playwrightChromium = [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
];
for (const candidate of playwrightChromium) {
  if (existsSync(candidate)) {
    Config.setBrowserExecutable(candidate);
    break;
  }
}
