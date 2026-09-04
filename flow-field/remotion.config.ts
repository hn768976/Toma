import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// The trails are drawn with WebGL, so headless Chrome needs a real GL backend.
// "angle" picks the best available; on a machine with no GPU it falls through to
// SwiftShader, which works but is a lot slower.
Config.setChromiumOpenGlRenderer("angle");

// Rebuilding ~300k ribbon quads a frame is CPU work, not a stuck render.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed CI images block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Use it there; on a normal machine this
// path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
