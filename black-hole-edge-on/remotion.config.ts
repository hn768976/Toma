import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);

// PNG rather than JPEG for the intermediate frames. This clip is a very
// bright object on a large, slow, dark falloff - the worst case for banding -
// and JPEG's chroma subsampling puts visible blocking into that falloff
// before H.264 ever sees it.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// Headless Chrome has no GPU here; swangle is ANGLE over SwiftShader and is
// the renderer that gives a working WebGL2 context in a container.
Config.setChromiumOpenGlRenderer("swangle");

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Use it there; on a normal machine this
// path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
