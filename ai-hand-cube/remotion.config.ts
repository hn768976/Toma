/**
 * Remotion config for the AI Hand Cube project.
 * Note: when using the Node.js APIs this file doesn't apply; pass the same
 * options to renderMedia()/renderStill() directly.
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium: ANGLE is the reliable backend (SwiftShader
// fallback on GPU-less machines). Same as passing --gl=angle on the CLI.
Config.setChromiumOpenGlRenderer("angle");

// Frames are PNG so the WebGL output (dither + grain) reaches the encoder
// without an extra lossy JPEG step.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// 3D frames are heavy; give each frame plenty of time on CPU-only machines.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Sandboxed environments that ship a Playwright Chromium: use it instead of
// downloading Remotion's headless shell. On a normal machine this path does
// not exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
