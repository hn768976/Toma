/**
 * Remotion CLI config for the HUD Acronym Rings template.
 * (Applies to `npx remotion render|still|studio`, not to the Node APIs.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium: ANGLE is the reliable backend
// (falls back to SwiftShader when no GPU is present).
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames so the x264 encode is the only lossy step.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);

// Sandboxed environments that can't download Remotion's Chrome Headless Shell
// but ship a Playwright one: reuse it. On a normal machine this path doesn't
// exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
