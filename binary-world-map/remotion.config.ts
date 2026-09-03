import {existsSync} from "node:fs";
import {Config} from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Use it when present; on a normal
// machine this path does not exist and Remotion falls back to its own browser.
for (const candidate of [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium",
]) {
  if (existsSync(candidate)) {
    Config.setBrowserExecutable(candidate);
    break;
  }
}
