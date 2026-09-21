import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames, not JPEG. JPEG puts chroma artifacts into exactly the smooth
// warm gradients this project works to keep clean, and ffmpeg decodes it as
// full range, which tags the output yuvj420p rather than yuv420p.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");
// No audio track in any composition; these are silent motion graphics.
// Without both of these Remotion writes a silent AAC track, which also
// stretches the file past 10.000s because AAC frames do not divide the
// duration evenly.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Sandboxed environments often block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium. Reuse it when it is there; on
// a normal machine this path does not exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
