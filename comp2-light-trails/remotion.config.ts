/**
 * Remotion CLI configuration for the Light Trails project.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// Drawing is Canvas 2D; two tabs in flight keeps memory modest at 4K.
Config.setConcurrency(2);
// Each frame is fully deterministic and self-contained, so a long timeout
// only matters for slow software (CPU) rendering at 4K.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that cannot download Remotion's managed Chrome
// Headless Shell can point to a local one. On a normal machine none of these
// paths exist and Remotion uses its own managed browser.
const localHeadlessShells = [
  process.env.REMOTION_BROWSER_EXECUTABLE ?? "",
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
];
const localShell = localHeadlessShells.find((p) => p && existsSync(p));
if (localShell) {
  Config.setBrowserExecutable(localShell);
}
