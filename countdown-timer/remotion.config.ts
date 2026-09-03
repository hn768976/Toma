/**
 * Remotion configuration. Note: when using the Node.JS APIs this file
 * does not apply — pass options directly to those APIs instead.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// The piece has no audio. Without this Remotion adds a silent AAC track
// to keep output uniform, which is not wanted in a graphic-only asset.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium. Reuse one when present;
// on a normal machine neither path exists and Remotion falls back to its
// default managed browser.
//
// The full chromium build is preferred over headless_shell because only
// it reads the platform certificate store, which matters behind a
// TLS-terminating egress proxy — @remotion/google-fonts fetches over
// HTTPS at render time and headless_shell rejects the proxy's CA.
const candidateBrowsers = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
];
const browser = candidateBrowsers.find((path) => existsSync(path));
if (browser) {
  Config.setBrowserExecutable(browser);
  // A full Chrome build only supports the new headless mode, which is
  // what "chrome-for-testing" selects; headless_shell wants the old one.
  Config.setChromeMode(
    browser.includes("headless_shell") ? "headless-shell" : "chrome-for-testing",
  );
  // Chromium's --single-process mode (Remotion's Linux default) skips
  // initialising the platform certificate store, so a TLS-terminating
  // egress proxy's CA is never trusted and the Google Fonts request
  // fails. Running multi-process restores it.
  Config.setChromiumMultiProcessOnLinux(true);
}
