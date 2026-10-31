/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Final delivery format: H.264 MP4, high quality, broadly compatible.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(14);
Config.setX264Preset("slow");

// The compositions are WebGL 2 fragment shaders. "swangle" (ANGLE on
// SwiftShader) works on any machine, including servers without a GPU.
// On a workstation with a GPU you can pass `--gl=angle` for speed.
Config.setChromiumOpenGlRenderer("swangle");

// Some sandboxed environments block downloading Remotion's Chrome
// Headless Shell but ship a Playwright one under /opt/pw-browsers.
// Reuse it if present; otherwise Remotion uses its own managed browser.
const pwRoot = "/opt/pw-browsers";
if (existsSync(pwRoot)) {
  const shell = readdirSync(pwRoot)
    .filter((d) => d.startsWith("chromium_headless_shell-"))
    .sort()
    .reverse()
    .map((d) =>
      path.join(
        pwRoot,
        d,
        "chrome-headless-shell-linux64",
        "chrome-headless-shell",
      ),
    )
    .find((p) => existsSync(p));
  if (shell) {
    Config.setBrowserExecutable(shell);
  }
}
