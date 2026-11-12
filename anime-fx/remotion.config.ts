import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames: lossless intermediate, so flat backgrounds and pure black stay
// exact and the determinism / loop checks can compare pixels.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setMuted(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Sandboxed machines sometimes ship a Playwright headless shell instead of
// letting Remotion download its own. Use it when present.
for (const p of [
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
]) {
  if (existsSync(p)) {
    Config.setBrowserExecutable(p);
    break;
  }
}
