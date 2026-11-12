/**
 * Remotion CLI configuration.
 * Note: When using the Node.JS APIs, the config file doesn't apply.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL via ANGLE + SwiftShader: works on any machine, including GPU-less
// servers/CI. On a workstation with a GPU you can pass `--gl=angle` instead.
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Tag output as standard BT.709 limited range (broadcast / web players).
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
// Three.js scenes are GPU/CPU heavy at 4K – keep a generous timeout.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block downloading Remotion's managed
// Chrome Headless Shell but ship a Playwright build. Reuse it if present;
// on a normal machine this path doesn't exist and Remotion uses its own.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
