/**
 * Remotion CLI config. (When rendering through the Node.js APIs this file is
 * not read — pass the same options to renderMedia/renderStill instead.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// three.js on WebGL2. In headless Chromium the WebGL2 context must come from
// ANGLE, otherwise it may be missing or fall back to a slow/blocked path.
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: grain and dither must survive until the
// final encode, and the determinism check compares frames byte for byte.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);

// Heavy WebGL frames: keep the per-frame timeout generous.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block the download of Remotion's own Chrome
// Headless Shell but ship a Playwright one. Reuse it when present; on a normal
// machine this path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
