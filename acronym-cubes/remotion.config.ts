import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Headless Chromium needs this for three.js;
// on a machine without a GPU ANGLE falls back to SwiftShader (slow but correct).
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Software GL (SwiftShader) already uses every core inside one tab, so one tab
// is fastest there. On a machine with a real GPU, try 2-4.
Config.setConcurrency(1);
// Each 4K frame can take several seconds on software GL.
Config.setTimeoutInMilliseconds(240000);

// Sandboxed environments that block Remotion's own Chrome download but ship
// a Playwright headless shell: reuse it. On a normal machine this path does
// not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
