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

// Accurate RGB -> YUV rounding in the encoder, so flat background colours
// survive yuv420p within +/-1 (the fast default can be 2 off on saturated
// colours such as #4A7AFF).
Config.overrideFfmpegCommand(({ type, args }) => {
  if (process.env.SHOW_FFMPEG) console.error(type, JSON.stringify(args));
  // the RGB -> YUV conversion happens in the pre-stitcher pass
  if (type !== "pre-stitcher") return args;
  const out = [...args];
  const at = out.indexOf("-pix_fmt");
  out.splice(at < 0 ? out.length - 2 : at, 0, "-sws_flags", "accurate_rnd+full_chroma_int+bitexact");
  return out;
});
