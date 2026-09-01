/**
 * Config for `npx remotion studio` / `npx remotion render`.
 * When using the Node.JS APIs, pass options directly instead.
 * https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
// The piece has no audio; do not emit a silent audio track.
Config.setMuted(true);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium. Reuse it there; on a
// normal machine these paths don't exist and Remotion uses its default.
for (const candidate of [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium",
]) {
  if (existsSync(candidate)) {
    Config.setBrowserExecutable(candidate);
    break;
  }
}
