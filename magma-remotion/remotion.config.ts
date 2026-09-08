import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// The field is a shader, so the browser needs a working WebGL backend. `angle`
// is the fast path; `swiftshader` renders identically without a GPU but is much
// slower. See the README for how to switch.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. On a normal machine this path does
// not exist and Remotion uses its managed browser.
const playwrightChromium =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightChromium)) {
  Config.setBrowserExecutable(playwrightChromium);
}
