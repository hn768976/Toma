// Remotion CLI configuration. (Node APIs ignore this file; pass the same
// options directly there.) See https://remotion.dev/docs/config
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
Config.setOverwriteOutput(true);

// WebGL needs a real GL backend in headless Chromium. "angle" uses the GPU
// through ANGLE. On a machine without a GPU, override on the command line
// with --gl=swangle (SwiftShader through ANGLE).
Config.setChromiumOpenGlRenderer("angle");

// PNG frames: lossless capture, so frame-by-frame determinism checks compare
// exact pixels and the encoder sees the dithered values untouched.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright build at this path; use it when present.
const playwrightHeadlessShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
