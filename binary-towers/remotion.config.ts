import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames, not JPEG: JPEG frames make ffmpeg tag the result yuvj420p (full
// range) and add a generation of chroma loss on a very dark, very fine image.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// No audio in this composition; do not let a silent AAC track ride along.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// The scene is WebGL. Headless Chromium needs a real GL backend; "angle" picks
// the best available, using a GPU when the machine has one and falling back to
// SwiftShader (CPU) when it does not.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's managed Chrome Headless Shell
// download but ship a Playwright Chromium. Use it when present; on a normal
// machine this path does not exist and Remotion downloads its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
