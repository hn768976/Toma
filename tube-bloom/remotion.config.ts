/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// WebGL2 is required. "swangle" (ANGLE on SwiftShader) works on every machine,
// including headless servers without a GPU. On a workstation with a GPU you
// can pass `--gl=angle` for faster renders; the output is identical in look.
Config.setChromiumOpenGlRenderer("swangle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Sandboxed/offline machines that cannot download Remotion's own Chrome
// Headless Shell can point to an existing one via REMOTION_BROWSER_EXECUTABLE.
// On this build machine a Playwright headless shell is auto-detected; on a
// normal machine neither exists and Remotion downloads its managed browser.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const findLocalHeadlessShell = (): string | null => {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) {
    return process.env.REMOTION_BROWSER_EXECUTABLE;
  }
  const root = "/opt/pw-browsers";
  if (!existsSync(root)) return null;
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith("chromium_headless_shell")) continue;
    for (const sub of ["chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/headless_shell"]) {
      const p = join(root, dir, sub);
      if (existsSync(p)) return p;
    }
  }
  return null;
};

const localShell = findLocalHeadlessShell();
if (localShell) {
  Config.setBrowserExecutable(localShell);
}
