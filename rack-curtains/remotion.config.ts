/**
 * Note: when rendering through the Node.JS APIs this file does not apply;
 * pass the equivalent options directly to the API instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Deliver plain limited-range yuv420p tagged bt709. Without the colour space
// set, the encode comes out as full-range yuvj420p, which some players read
// back with crushed blacks - and the blue haze here has a lot of low end.
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");

// There is no audio in these compositions, so don't let Remotion attach a
// silent track to the deliverable.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

// The scene is WebGL, so the headless browser must be started with a real
// GL backend. ANGLE picks a GPU when one is present and falls back to
// SwiftShader (software) when it isn't.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it
// there; on a normal machine this path won't exist and Remotion falls back
// to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
