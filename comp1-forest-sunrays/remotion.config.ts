/**
 * Remotion CLI configuration.
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

// The compositions are WebGL 2 fragment shaders. "swangle" (ANGLE on top of
// SwiftShader) gives WebGL 2 on every machine, including headless servers and
// CI without a GPU. On a machine with a GPU you may pass --gl=angle for speed.
Config.setChromiumOpenGlRenderer("swangle");

// Optional: sandboxed environments that cannot download Remotion's Chrome
// Headless Shell but ship a Playwright one. On a normal machine this finds
// nothing and Remotion uses its own managed browser.
const pwRoot = "/opt/pw-browsers";
if (existsSync(pwRoot)) {
  const shell = readdirSync(pwRoot)
    .filter((d) => d.startsWith("chromium_headless_shell-"))
    .flatMap((d) => [
      `${pwRoot}/${d}/chrome-headless-shell-linux64/chrome-headless-shell`,
      `${pwRoot}/${d}/chrome-linux/headless_shell`,
    ])
    .find((p) => existsSync(p));
  if (shell) Config.setBrowserExecutable(shell);
}
