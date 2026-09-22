import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG intermediates, not JPEG: these are large smooth dark gradients under
// bright glow, and JPEG intermediates would add their own banding on top of
// whatever the H.264 encode does.
Config.setVideoImageFormat("png");
Config.setStillImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// No audio stream in the output. Remotion adds a silent AAC track by default,
// which also pads the duration past the exact 10.000s / 20.000s (the audio
// frame granularity is what makes a 600-frame clip measure 20.053s).
Config.setEnforceAudioTrack(false);
Config.setMuted(true);
Config.setOverwriteOutput(true);
// These are 2D scenes, so there is nothing for the GPU path to do. Note on
// byte-level reproducibility: the React output is a pure function of the
// frame and repeated single-frame renders are byte-identical, but Chromium's
// rasterisation of small SVG Gaussian-blur filters varies by up to ~11/255 on
// a few hundred pixels between separate *sequence* renders in a container.
// That happens at any concurrency and under both "angle" and "swiftshader",
// so it is a property of the rasteriser, not of this project. See README.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Reuse it there; on a normal
// machine this path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
