import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
// WebGL2 through ANGLE. On a machine with a GPU use "angle"; in a GPU-less
// container ANGLE's SwiftShader backend ("swangle") is the reliable choice.
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as "angle" | "swangle" | undefined) ?? "angle",
);
// Large city textures: give each tab time to build them on first load.
Config.setDelayRenderTimeoutInMilliseconds(180000);

// Sandboxed containers that ship a Playwright Chromium: reuse it instead of
// downloading Remotion's headless shell. Elsewhere this path doesn't exist.
const pwShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pwShell)) {
  Config.setBrowserExecutable(pwShell);
}
