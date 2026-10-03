/**
 * Remotion CLI config. All looks are WebGL2; headless Chromium must use ANGLE
 * (`--gl=angle`), which is set here so every `npx remotion render|still`
 * picks it up. WebGPU is not used anywhere.
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Heavy GPU work per frame: give delayRender() plenty of room.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed build machine ships a Playwright headless shell; use it when it
// exists, otherwise Remotion downloads its own Chrome Headless Shell.
const pwShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pwShell)) {
  Config.setBrowserExecutable(pwShell);
}
