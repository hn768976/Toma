/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
Config.overrideBundlerConfig(enableTailwind);

// WebGL scene: use ANGLE on top of SwiftShader so it renders identically on
// machines with or without a GPU. Pass --gl=angle on a GPU machine for speed.
Config.setChromiumOpenGlRenderer("swangle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Tag and convert as limited-range BT.709 (standard HD delivery) instead of
// the full-range BT.601 that the JPEG frame pipeline would otherwise produce.
Config.setColorSpace("bt709");
Config.setCrf(16);

// Sandboxed environments that block Remotion's browser download often ship a
// Playwright headless shell; reuse it when present, else Remotion downloads its own.
const pwRoot = "/opt/pw-browsers";
if (existsSync(pwRoot)) {
  const shell = readdirSync(pwRoot)
    .filter((d) => d.startsWith("chromium_headless_shell-"))
    .map((d) => join(pwRoot, d, "chrome-headless-shell-linux64", "chrome-headless-shell"))
    .find((p) => existsSync(p));
  if (shell) Config.setBrowserExecutable(shell);
}
