import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL2 through ANGLE. On machines without a GPU, ANGLE falls back to its
// SwiftShader backend, which is slow but deterministic.
Config.setChromiumOpenGlRenderer("angle");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setConcurrency(1);
// Generous: the first frame waits for the head mesh, fonts and the
// procedural textures to build.
Config.setDelayRenderTimeoutInMilliseconds(240000);

// Some sandboxed environments block downloading Remotion's own headless
// shell but ship a Playwright Chromium here. Elsewhere this path does not
// exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
