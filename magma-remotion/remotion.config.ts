import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");

// Lossless intermediate frames. The default, JPEG at quality 80, visibly
// softens this content: the 2% grain is what keeps the large near-black plate
// interiors from banding in H.264, and JPEG is very willing to spend that
// grain. Measured against a lossless still of the same frame, PNG intermediates
// gain 2.7 dB (31.7 -> 34.4 dB PSNR) through an otherwise identical encode.
// JPEG frames also make FFmpeg tag the output full-range `yuvj420p` rather than
// the `yuv420p` this project is specified to deliver.
Config.setVideoImageFormat("png");

// The compositions carry no audio, so don't let an empty AAC track ride along.
Config.setMuted(true);

// The field is a shader, so the browser needs a working WebGL backend. `angle`
// is the fast path; `swiftshader` renders identically without a GPU but is much
// slower. See the README for how to switch.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. On a normal machine this path does
// not exist and Remotion uses its managed browser.
const playwrightChromium =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightChromium)) {
  Config.setBrowserExecutable(playwrightChromium);
}
