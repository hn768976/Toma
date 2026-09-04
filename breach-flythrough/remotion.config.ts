/**
 * Note: when rendering through the Node APIs this file does not apply —
 * pass the same options directly to the API instead.
 * All options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// The scene is almost entirely very dark gradients. Lossy intermediate frames
// put visible blocking into those falloffs before the encoder ever sees them,
// so the frames are handed over as PNG and the banding is fought once, in the
// encoder, with a low CRF.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// No audio: a silent track would push the container past an exact 12.000s and
// put a hitch in the loop.
Config.setMuted(true);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Reuse that when it is present; on a
// normal machine the path does not exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
