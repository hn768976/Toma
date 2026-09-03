import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The piece has no audio; without this Remotion writes a silent AAC track.
Config.setMuted(true);

// This sandbox blocks Remotion's own Chrome Headless Shell download but ships a
// Playwright Chromium. Reuse it here; on a normal machine the path is absent and
// Remotion falls back to its managed browser.
const shell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(shell)) {
  Config.setBrowserExecutable(shell);
}
