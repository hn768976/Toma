/**
 * Remotion config for the Rate Board / Light Streaks / Glitch Dot Map project.
 * (Applies to the CLI and Studio; the Node APIs ignore this file.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames, not JPEG: the final-pass dither (+-1/255) and the film grain
// would be destroyed by JPEG compression and the gradients would band.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setColorSpace("bt709");
// No audio stream at all (a muted track would still add an AAC stream and pad the duration).
Config.setMuted(true);

// WebGL2 in headless Chromium (software ANGLE/SwiftShader when there is no GPU).
Config.setChromiumOpenGlRenderer("angle");

// A 4K frame through software GL can take longer than the 30 s default.
Config.setDelayRenderTimeoutInMilliseconds(300_000);

// Sandboxed dev boxes may not be able to download Remotion's own Chrome
// Headless Shell but ship a Playwright one at this path. Reuse it there;
// on a normal machine the path does not exist and Remotion uses its own.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}

// Encoder: dark gradients band easily once x264 smooths away the dither and grain.
// -tune grain keeps the grain, and a slower preset spends bits on it.
Config.setX264Preset("slow");
Config.overrideFfmpegCommand(({ type, args }) => {
  if (type !== "stitcher") return args;
  const out = args.slice(0, -1);
  const last = args[args.length - 1]; // output path
  return [...out, "-tune", "grain", last];
});
