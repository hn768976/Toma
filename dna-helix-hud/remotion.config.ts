/**
 * Remotion CLI configuration (applies to `npx remotion render/still/studio`).
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("png");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(20);
// Software WebGL (swangle) can take several seconds per 4K frame.
Config.setDelayRenderTimeoutInMilliseconds(180000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// but ship a Playwright Chromium: reuse it. On a normal machine this path does
// not exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
// WebGL: "angle" uses the GPU. GPU-less machines (CI, containers) fall back
// to SwiftShader via "swangle"; override with --gl=<renderer> if needed.
Config.setChromiumOpenGlRenderer("angle");
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
  Config.setChromiumOpenGlRenderer("swangle");
}
