/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL needs a GL backend in headless Chrome. "swangle" (ANGLE on top of
// SwiftShader) works on any machine, including servers without a GPU.
// On a workstation with a GPU you can pass --gl=angle for faster renders.
Config.setChromiumOpenGlRenderer("swangle");
// PNG frames keep the encoder input in RGB, so the MP4 is standard
// limited-range yuv420p (JPEG frames would be passed through as yuvj420p).
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
// WebGL frames at 4K can take a few seconds each on CPU-only machines.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that block downloading Chrome Headless Shell may ship
// a Playwright build under /opt/pw-browsers. On a normal machine that folder
// does not exist and Remotion downloads its own browser.
const pwRoot = "/opt/pw-browsers";
if (existsSync(pwRoot)) {
  const shell = readdirSync(pwRoot)
    .filter((d) => d.startsWith("chromium_headless_shell-"))
    .map((d) => join(pwRoot, d, "chrome-linux", "headless_shell"))
    .concat(
      readdirSync(pwRoot)
        .filter((d) => d.startsWith("chromium_headless_shell-"))
        .map((d) => join(pwRoot, d, "chrome-headless-shell-linux64", "chrome-headless-shell")),
    )
    .find((p) => existsSync(p));
  if (shell) {
    Config.setBrowserExecutable(shell);
  }
}
