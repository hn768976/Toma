/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// The scene is drawn with WebGL 2. "swangle" (software ANGLE) works on every
// machine, including GPU-less servers. On a machine with a GPU you can render
// much faster by passing --gl=angle (macOS/Windows) or --gl=angle-egl (Linux).
Config.setChromiumOpenGlRenderer("swangle");

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright one at this path. Reuse it when it exists; on a
// normal machine the path is absent and Remotion uses its managed browser.
const sandboxHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(sandboxHeadlessShell)) {
  Config.setBrowserExecutable(sandboxHeadlessShell);
}
