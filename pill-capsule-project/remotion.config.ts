import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

/**
 * Note: when rendering through the Node APIs this file does not apply; pass
 * the same options directly.
 */

// WebGL in headless Chromium needs ANGLE. Without it the compositions render
// black or fall back to SwiftShader and crawl.
Config.setChromiumOpenGlRenderer("angle");

// PNG keeps the dither and the gradients clean; JPEG frames would reintroduce
// exactly the banding the shader dither exists to remove.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setChromiumDisableWebSecurity(false);

// None of these compositions has audio, but Remotion still muxes a silent AAC
// track by default. That fails the "no audio stream" check, and because the
// silent track runs a little longer than the video it also pushes the
// container duration past the exact 10.000 / 15.000 / 20.000 seconds the
// delivery calls for. The video stream itself is exact either way.
Config.setMuted(true);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Use it when it is there; on a
// normal machine this path does not exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
