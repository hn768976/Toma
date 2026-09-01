/**
 * Config for `npx remotion studio` / `npx remotion render`.
 * (When using the Node.js APIs this file does not apply — pass options directly.)
 * All options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// The piece has no audio; without this Remotion muxes a silent AAC track.
Config.setMuted(true);

// The frame is one large smooth gradient, so JPEG intermediates band badly.
// PNG frames cost more disk but keep the blurs clean before encoding.
Config.setVideoImageFormat("png");

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium at this path. Reuse it there; on a normal
// machine the path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
