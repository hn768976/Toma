/**
 * Remotion CLI config. Applies to `npx remotion render|still|studio`.
 * All looks are WebGL2 (three.js via @remotion/three); headless Chromium
 * must run with the ANGLE GL backend (`--gl=angle`).
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setChromiumOpenGlRenderer("angle");
// Frames are captured losslessly; H.264 is only applied by the encoder.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// Software GL (no GPU) can take several seconds per 4K frame; allow it.
Config.setTimeoutInMilliseconds(240000);

// Sandboxed CI images sometimes block Remotion's own Chrome download but
// ship a Playwright headless shell. Use it when present; elsewhere Remotion
// falls back to its managed Chrome Headless Shell.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
