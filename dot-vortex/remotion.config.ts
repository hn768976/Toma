/**
 * Remotion CLI configuration. Note: this file does NOT apply when using
 * the Node.js rendering APIs — pass the options directly there.
 *
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// The dot field is fine, high-frequency detail on black. JPEG frames
// would smear it, so capture PNG frames and let the encoder do the only
// lossy step.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// Pure motion graphic: no silent audio track in the output.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);
Config.setCrf(16);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium. Reuse it when present;
// on a normal machine this path won't exist and Remotion falls back to
// its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
