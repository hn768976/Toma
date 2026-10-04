/**
 * Remotion CLI configuration. (The Node.js render APIs ignore this file; pass
 * the same options directly there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// All three looks are WebGL2. "angle" uses the GPU through ANGLE; on a machine
// without a GPU, pass --gl=swangle (ANGLE + SwiftShader, CPU) instead.
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// Keep grain and dither through H.264 (otherwise x264 smooths them away in
// dark, saturated gradients and the Particle Smoke background bands).
Config.overrideFfmpegCommand(({ args }) => {
  const i = args.indexOf("libx264");
  if (args.includes("-tune")) return args;
  return i === -1 ? args : [...args.slice(0, i + 1), "-tune", "grain", ...args.slice(i + 1)];
});
// The map textures and the 3M-particle buffer are large; a few tabs at once
// is plenty.
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Sandboxed environments that block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium can use it instead.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
