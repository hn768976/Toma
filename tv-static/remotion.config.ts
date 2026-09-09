/**
 * Note: when using the Node.JS APIs this file does not apply; pass options
 * directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// Per-pixel noise that re-randomises every frame is the worst case for
// inter-frame compression, and unlike a sparse overlay plate there is no
// black area to compress cheaply. Anything softer than this smears the
// speckle into grey blocks.
Config.setCrf(11);

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it there;
// on a normal machine this path does not exist and Remotion falls back to its
// default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
