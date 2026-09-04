/**
 * Config for `npx remotion studio` and `npx remotion render`.
 * Note: when using the Node.js APIs this file does not apply.
 * All options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames, not JPEG: the listings are 8px text and JPEG rings around
// them. It also keeps the output tagged yuv420p (limited range) rather
// than yuvj420p, which full-range JPEG input would force.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// The screen is nearly all fine text: keep the encode close to lossless so
// the code panel stays crisp after H.264.
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it
// there; on a normal machine the path does not exist and Remotion falls
// back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
