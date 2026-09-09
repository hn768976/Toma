import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png"); // no JPEG ringing on the border at 4K
Config.setOverwriteOutput(true);

/**
 * Remotion downloads and manages its own Chrome Headless Shell, which is what
 * you want on a normal machine — nothing below will apply there.
 *
 * Containers and CI images often block that download but already ship a
 * Chromium, so allow one to be pointed at explicitly, and fall back to the
 * path Playwright's images use.
 */
const browser =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(browser)) {
  Config.setBrowserExecutable(browser);
}
