/**
 * Config for the Remotion CLI. When rendering through the Node APIs these
 * options do not apply and have to be passed to the API directly.
 * https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG intermediates: JPEG artefacts on a grainy frame are extra entropy the
// encoder then has to pay for, and JPEG tags the output full range (yuvj420p).
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumDisableWebSecurity(false);

// Sandboxed CI images sometimes cannot download Remotion's own Chrome Headless
// Shell but do ship a Playwright Chromium. Reuse it when it is there; on a
// normal machine this path does not exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
