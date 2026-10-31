/**
 * Remotion CLI configuration.
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// The compositions render with Three.js / WebGL2. "swangle" (ANGLE on
// SwiftShader) works on any machine, including headless servers without a
// GPU. On a workstation with a GPU you may pass --gl=angle for speed.
Config.setChromiumOpenGlRenderer("swangle");
Config.setConcurrency(2);

// Optional: sandboxed environments that cannot download Remotion's
// Chrome Headless Shell can point to an existing one. Set
// REMOTION_BROWSER_EXECUTABLE, or a Playwright headless shell under
// /opt/pw-browsers is picked up automatically. On a normal machine
// neither exists and Remotion downloads its own browser.
const findPlaywrightShell = (): string | null => {
  const root = "/opt/pw-browsers";
  if (!existsSync(root)) return null;
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith("chromium_headless_shell")) continue;
    const candidate = path.join(
      root,
      dir,
      "chrome-headless-shell-linux64",
      "chrome-headless-shell",
    );
    if (existsSync(candidate)) return candidate;
  }
  return null;
};
const browser =
  process.env.REMOTION_BROWSER_EXECUTABLE ?? findPlaywrightShell();
if (browser) {
  Config.setBrowserExecutable(browser);
}
