/**
 * Remotion CLI config. Applies to `npx remotion studio|render|still`.
 * WebGL2 via ANGLE: headless Chromium needs --gl=angle (set here, can also
 * be passed on the command line).
 */
import { Config } from "@remotion/cli/config";

Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Sandboxed CI containers that can't download Remotion's Chrome Headless
// Shell ship a Playwright one at this path; elsewhere this is a no-op.
import { existsSync } from "node:fs";
const pwShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pwShell)) Config.setBrowserExecutable(pwShell);
