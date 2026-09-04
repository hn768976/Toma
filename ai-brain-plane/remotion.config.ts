/**
 * Config for `remotion studio` and the `remotion render` CLI.
 * (The Node APIs ignore this file; pass options directly there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Delivery format. Setting these here rather than on the CLI means the plain
// render command in the README produces a correctly tagged file:
//   - yuv420p at limited range, tagged BT.709. Without this, Remotion's MJPEG
//     intermediate leaves x264 tagging the output yuvj420p (full range), which
//     some players then re-level.
//   - no audio track: this is a motion graphic and Remotion would otherwise
//     mux a silent AAC stream into it.
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setMuted(true);

// The scene is WebGL. On a machine with no GPU, ANGLE's SwiftShader backend
// renders it correctly in software; on a machine with one, "angle" picks the
// hardware path. Either way this must be set or the canvas comes back black.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Use it there; elsewhere this path
// does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
