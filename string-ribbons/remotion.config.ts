/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
Config.overrideBundlerConfig(enableTailwind);

// Strands are rendered with a small WebGL2 shader. "swangle" (ANGLE on
// SwiftShader) gives a working WebGL2 context on every machine, GPU or not.
Config.setChromiumOpenGlRenderer("swangle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Standard broadcast-range BT.709, correctly tagged for every player.
Config.setColorSpace("bt709");

// Optional: reuse a pre-installed Chrome Headless Shell (sandboxed CI images)
// instead of letting Remotion download its own. Ignored when not present.
const preinstalledShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(preinstalledShell)) {
  Config.setBrowserExecutable(preinstalledShell);
}
