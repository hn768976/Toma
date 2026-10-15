import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. In headless Chromium this is the reliable GL path
// (falls back to SwiftShader-on-ANGLE on machines without a GPU).
Config.setChromiumOpenGlRenderer("angle");
Config.setOverwriteOutput(true);
Config.setVideoImageFormat("png");

// data/elements.csv is imported as a string (single source of truth).
Config.overrideWebpackConfig((config) => ({
  ...config,
  module: {
    ...config.module,
    rules: [...(config.module?.rules ?? []), { test: /\.csv$/, type: "asset/source" }],
  },
}));

// Some sandboxed environments block Remotion's Chrome Headless Shell download
// but ship a Playwright build here. On a normal machine this path does not
// exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
