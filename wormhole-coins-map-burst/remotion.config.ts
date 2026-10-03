/**
 * Remotion CLI config. All CLI renders (studio, still, render) read this file.
 * See README.md for the per-composition 4K commands.
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);

// WebGL2 in headless Chromium: ANGLE. Override per render with --gl=<renderer>
// (e.g. --gl=swangle on a machine without any GPU).
Config.setChromiumOpenGlRenderer("angle");

// Frames are rendered out of order on several tabs. Every visual is a pure
// function of the frame number, so any concurrency is safe.
Config.setConcurrency(4);
Config.setTimeoutInMilliseconds(240000);

// Optional: reuse a locally installed Chromium headless shell instead of
// letting Remotion download its own (set REMOTION_BROWSER=/path/to/headless_shell).
const envBrowser = process.env.REMOTION_BROWSER;
if (envBrowser && existsSync(envBrowser)) {
  Config.setBrowserExecutable(envBrowser);
}

// Sparkle Burst ends on 30 frames of pure black (330–359). Force an H.264
// keyframe at frame 330 so the black tail is coded fresh instead of
// inheriting low-level residue from the fade (keeps the encoded black at 0,0,0).
// Harmless for the other compositions (one extra keyframe).
// Note: the override is applied by the final stitcher, so render with
// --disallow-parallel-encoding (the preview script and README commands do).
Config.overrideFfmpegCommand(({ args }) => {
  const i = args.indexOf("-c:v");
  if (i === -1) return args;
  const out = [...args];
  out.splice(i, 0, "-force_key_frames", "expr:eq(n,330)");
  return out;
});
