/**
 * Remotion CLI configuration for the "Light Streams" project.
 * Note: When using the Node.JS APIs, the config file doesn't apply.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync, readdirSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// Standard BT.709 limited ("TV") range output — plays correctly everywhere.
Config.setColorSpace("bt709");
// The composition is drawn with WebGL 2. "swangle" (ANGLE on SwiftShader)
// works on every machine, including GPU-less servers/containers, and gives
// bit-identical frames. On a machine with a GPU you can pass `--gl=angle`
// to render faster.
Config.setChromiumOpenGlRenderer("swangle");
Config.setConcurrency(2);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Reuse it when present; elsewhere
// Remotion falls back to its default managed browser.
const pwRoot = "/opt/pw-browsers";
if (existsSync(pwRoot)) {
  const shell = readdirSync(pwRoot)
    .filter((d) => d.startsWith("chromium_headless_shell-"))
    .flatMap((d) => [
      `${pwRoot}/${d}/chrome-headless-shell-linux64/chrome-headless-shell`,
      `${pwRoot}/${d}/chrome-linux/headless_shell`,
    ])
    .find((p) => existsSync(p));
  if (shell) {
    Config.setBrowserExecutable(shell);
  }
}
