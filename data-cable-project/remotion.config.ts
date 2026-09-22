import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// H.264 / yuv420p, high quality. CRF is also passed explicitly on the CLI.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// The references all carry an audio track. These must not: there is no sound
// in the scene, and an empty track is a defect in a stock clip.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// Software WebGL2 through ANGLE/SwiftShader. There is no GPU on the render
// box; "angle" is the flag that makes headless Chromium expose WebGL2 at all.
Config.setChromiumOpenGlRenderer("angle");

// The digit texture is 4096px and the tube geometry is dense, so frames need
// room to compile shaders and upload the texture on first paint.
Config.setDelayRenderTimeoutInMilliseconds(240000);

// This box cannot reach Remotion's Chromium download host, and a Chromium of
// the right vintage is already present. Override via REMOTION_BROWSER_EXECUTABLE
// if you render elsewhere.
const browser = process.env.REMOTION_BROWSER_EXECUTABLE;
if (browser) {
  Config.setBrowserExecutable(browser);
}
