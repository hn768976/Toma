import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);

// Each tab builds its point layouts / land mask / candle tiles and compiles
// shaders before the first frame. With software GL and several tabs at once
// that can exceed Remotion's 30 s default, so allow more time.
Config.setDelayRenderTimeoutInMilliseconds(180000);

// WebGL2 in headless Chromium. "angle" is the flag the brief asks for and is
// right on a machine with a GPU. On a GPU-less box (CI, cloud containers)
// set REMOTION_GL=swangle to get ANGLE-on-SwiftShader instead.
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as "angle" | "swangle" | undefined) ?? "angle",
);

// Sandboxed environments that block Remotion's own Chrome Headless Shell
// download but ship Playwright's Chromium: reuse it if it exists.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
