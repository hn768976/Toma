import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setStillImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("swangle");
Config.setDelayRenderTimeoutInMilliseconds(1_800_000);

// Sandboxed environments that ship Playwright's Chromium instead of letting
// Remotion download its own headless shell.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
