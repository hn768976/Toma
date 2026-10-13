// Remotion CLI config. https://remotion.dev/docs/config
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL2 in headless Chromium: use ANGLE (equivalent to --gl=angle).
Config.setChromiumOpenGlRenderer("angle");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed CI containers sometimes block Remotion's Chrome download but ship a
// Playwright headless shell. Use it when present; otherwise Remotion's own.
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pw)) Config.setBrowserExecutable(pw);
