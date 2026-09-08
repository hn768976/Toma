/**
 * Remotion configuration for the Isometric Data Centre Build project.
 *
 * Note: when rendering through the Node.js APIs this file does not apply —
 * pass the equivalent options directly to the APIs instead.
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// H.264 / yuv420p / Rec. 709, and no silent audio track on a motion graphic.
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setMuted(true);

// WebGL in headless Chromium needs the ANGLE backend. Without this the
// three.js canvas comes back blank (or falls back to a software path that
// is far slower). Equivalent to passing --gl=angle on the command line.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it
// there; on a normal machine the path does not exist and Remotion falls
// back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
