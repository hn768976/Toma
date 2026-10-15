import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 everywhere (PixiJS 8 + three.js). ANGLE is the reliable GL backend
// for headless Chromium; equivalent to passing --gl=angle on the CLI.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// Generous: 4K frames on a software GL device can take a while.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Some sandboxed environments block downloading Remotion's own headless
// shell but ship a Playwright Chromium here. Elsewhere this path does not
// exist and Remotion uses its default managed browser.
const pwShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pwShell)) {
  Config.setBrowserExecutable(pwShell);
}
