/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL 2 through ANGLE (same as passing --gl=angle).
Config.setChromiumOpenGlRenderer("angle");
// PNG frames between Chrome and the encoder: JPEG would band the dark
// gradients before H.264 ever sees them.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// A software-rendered 4K frame with motion blur can take a while.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// H.264 tuning for dark, soft gradients: without it the encoder smooths the
// +-1/255 dither away and the gradients band. (Adaptive quantisation mode 3
// favours dark areas; weaker deblocking and psy-rd keep fine noise.)
Config.overrideFfmpegCommand(({ args }) => {
  // applies to whichever ffmpeg call does the H.264 encode (Remotion encodes
  // while it renders and then only muxes)
  if (!args.includes("libx264")) {
    return args;
  }
  const out = args[args.length - 1];
  return [
    ...args.slice(0, -1),
    "-x264-params",
    "aq-mode=3:aq-strength=1.2:deblock=-2,-2:psy-rd=1.0,0.3:no-dct-decimate=1",
    out,
  ];
});


// Some sandboxed build machines cannot download Remotion's own Chrome
// Headless Shell but ship one at this path. On a normal machine the path
// does not exist and Remotion uses its managed browser as usual.
const sandboxShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(sandboxShell)) {
  Config.setBrowserExecutable(sandboxShell);
}
