import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium: ANGLE is the reliable backend (works with and
// without a GPU). Equivalent CLI flag: --gl=angle
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: JPEG intermediates would add blocking/banding
// to the soft glows before the H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// Software-GL (CPU) machines can take a while per 4K frame; be patient.
Config.setDelayRenderTimeoutInMilliseconds(180000);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// H.264 banding guard. In saturated deep blues most of the gradient lives in
// the 4:2:0 chroma planes; at default settings x264 quantises chroma so
// coarsely (and drops small coefficients) that the grain/dither there is
// discarded and 1-level contours appear. A finer chroma quantiser, no
// deadzones and dark-biased AQ keep the gradients smooth at CRF 16.
const X264_PARAMS =
  "deadzone-inter=0:deadzone-intra=0:no-dct-decimate=1:chroma-qp-offset=-6:aq-mode=3";
Config.overrideFfmpegCommand(({ args }) => {
  const i = args.indexOf("libx264");
  if (i === -1) return args; // pre-stitcher does the encode; stitcher may too
  const out = [...args];
  out.splice(out.length - 1, 0, "-x264-params", X264_PARAMS);
  return out;
});

// Sandboxed environments that ship a Playwright headless shell instead of
// letting Remotion download its own: reuse it if present. On a normal machine
// this path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
