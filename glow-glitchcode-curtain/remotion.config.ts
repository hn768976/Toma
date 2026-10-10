/**
 * Remotion config for the Glow / Glitch Code / Light Curtain project.
 *
 * - PNG intermediates: no JPEG blocking in the dark gradients, which would
 *   show up as banding after H.264.
 * - ANGLE GL backend: Light Curtain uses WebGL2 and headless Chromium needs
 *   `--gl=angle` (software SwiftShader when no GPU is present). It is also set
 *   here so the flag does not have to be passed on every command.
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments cannot download Remotion's own Chrome Headless
// Shell but ship a Playwright one. Use it when present; elsewhere this path
// does not exist and Remotion uses its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
