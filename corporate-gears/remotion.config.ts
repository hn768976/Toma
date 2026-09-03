/**
 * Applies to the Remotion CLI (studio / render / still).
 * See https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setOverwriteOutput(true);
// Stock background loop: no audio track at all, not a silent one.
Config.setMuted(true);
// Broad gold/blue gradients band badly at low bitrates; keep the preview crf
// low and rely on the film grain layer to dither what is left.
Config.setCrf(16);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. On a normal machine this path does not
// exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
