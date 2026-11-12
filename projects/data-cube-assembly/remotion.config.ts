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
Config.setDefaultPremountInSeconds(2);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
// WebGL needs a GL backend in headless Chrome. "swangle" (SwiftShader via ANGLE)
// works on every machine incl. CI/servers without a GPU. On a workstation with a
// GPU you can pass `--gl=angle` on the command line for much faster renders.
Config.setChromiumOpenGlRenderer("swangle");
Config.setTimeoutInMilliseconds(240000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// may ship a Playwright headless shell under /opt/pw-browsers. Use it if present;
// on a normal machine this is skipped and Remotion manages its own browser.
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
