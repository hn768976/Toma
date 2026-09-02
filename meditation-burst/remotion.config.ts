import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The piece has no audio and none should be fabricated. Without this,
// Remotion still muxes a silent AAC track into the container, which also
// stretches the file's reported duration past the 20.000s the video
// stream actually covers.
Config.setMuted(true);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it
// there; on a normal machine the path is absent and Remotion falls back
// to its own managed browser download.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
