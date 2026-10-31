import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Frames are captured as PNG so the empty black / white stays exact
// before the H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setMuted(true); // no audio track
// p5.brush paints its crayon textures through a WebGL2 context (once per
// variant, offscreen). SwiftShader ("swangle") is a CPU rasteriser, so the
// textures come out identical on every render.
Config.setChromiumOpenGlRenderer("swangle");

// Sandboxed environments that ship a Playwright headless shell: use it.
// On a normal machine this path doesn't exist and Remotion downloads its own.
const shell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(shell)) {
  Config.setBrowserExecutable(shell);
}

// The crayon textures (looks 3-4) take a few seconds per boil variant to
// paint on first use in each browser tab.
Config.setDelayRenderTimeoutInMilliseconds(600000);
