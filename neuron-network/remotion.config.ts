/**
 * Remotion configuration.
 *
 * Note: when rendering through the Node.js APIs this file does not apply --
 * pass the options directly instead.
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// These compositions carry no audio and must not be delivered with a silent
// track. `setEnforceAudioTrack(false)` only stops Remotion FORCING one -- it
// still muxes a silent AAC stream, which the delivery checks reject.
// `setMuted(true)` is what omits audio entirely.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// Keep the dither through the encoder. The grain pass puts real per-pixel
// noise in the frame, but x264 discards fine noise in flat regions -- it is
// exactly the low-energy high-frequency content the quantiser drops -- and
// the near-white field of look 5 came back with visible contour steps.
// `-tune grain` raises the quantiser's tolerance for it.
Config.overrideFfmpegCommand(({ args }) => {
  const out = [...args];
  const crfIndex = out.indexOf("-crf");
  const at = crfIndex >= 0 ? crfIndex + 2 : Math.max(0, out.length - 1);
  out.splice(at, 0, "-tune", "grain");
  return out;
});

// Software GL. ANGLE is the fastest path that still supports WebGL2 in
// headless Chromium; SwiftShader is the fallback when ANGLE is unavailable.
Config.setChromiumOpenGlRenderer("angle");

// Software GL compiles these shaders slowly on the first frame of each
// worker, which overruns the 30s default.
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium. Reuse it when present;
// on a normal machine this path does not exist and Remotion falls back
// to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
