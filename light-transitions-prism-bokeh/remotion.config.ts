import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PixiJS 8 on WebGL2. Headless Chromium needs ANGLE for a working WebGL2
// context (it falls back to SwiftShader when there is no GPU).
Config.setChromiumOpenGlRenderer("angle");
// Lossless frames into the encoder: JPEG intermediates would band the gradients.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Software WebGL at 4K can take well over the default 30s per frame.
Config.setDelayRenderTimeoutInMilliseconds(180000);
// Pure video: no silent audio track (it would also pad the duration).
Config.setMuted(true);
// Every composition is a whole number of seconds, so a keyframe on every 30th
// frame lands on the last frame. A keyframe of a black frame decodes to exact
// black; a predicted one can keep a faint residue of earlier light.
Config.overrideFfmpegCommand(({ args }) => {
  if (!args.includes("libx264")) return args;
  const out = args[args.length - 1];
  return [...args.slice(0, -1), "-force_key_frames", "expr:eq(mod(n+1,30),0)", out];
});

// Sandboxes that cannot download Remotion's Chrome Headless Shell may ship a
// Playwright one; use it if present, otherwise Remotion's default applies.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
