/**
 * Remotion configuration. When rendering through the Node APIs this file is
 * ignored and options must be passed directly.
 * https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Some sandboxed environments block Remotion's Chrome Headless Shell download
// but ship a Playwright Chromium. Reuse it there; on a normal machine this
// path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
