/**
 * Note: when rendering through the Node APIs this file does not apply —
 * pass the options to the API directly.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// PNG frames rather than JPEG: the teal field is a wide, shallow ramp and
// JPEG's chroma subsampling puts visible blotches in it before the encoder
// ever sees the frame.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);

// The clip is silent by design. Without both of these Remotion writes a
// muted AAC track anyway, which also pushes the container past 15.00s.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium at this path. Use it when it is
// there; on a normal machine the path is absent and Remotion falls back to
// its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
