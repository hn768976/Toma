/**
 * Config for the Remotion CLI. Node APIs ignore this file.
 * https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames rather than JPEG: the piece is all fine grain and thin glyph
// strokes, which JPEG's intermediate pass smears, and a JPEG pipe also makes
// ffmpeg tag the output full-range (yuvj420p) instead of yuv420p.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("swangle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Use it there; on a normal machine
// this path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
