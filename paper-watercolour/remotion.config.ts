import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL is required. On a machine with a GPU use --gl=angle (see README);
// in a GPU-less container use --gl=swangle (SwiftShader).
Config.setChromiumOpenGlRenderer("angle");

// Sandboxed dev boxes ship a Playwright headless shell instead of letting
// Remotion download its own; on a normal machine this path doesn't exist.
const pwShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pwShell)) {
  Config.setBrowserExecutable(pwShell);
}
