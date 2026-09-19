/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setRspack(true);
Config.setOverwriteOutput(true);

// These compositions are nothing but fine, high-frequency detail, which is the
// worst case for a lossy intermediate: rendering through JPEG frames measurably
// softened the highlights (the share of pixels at pure white fell from 22% to
// 13% between the still and the encoded file). PNG frames cost render time and
// disk but leave the only generation loss in the H.264 encode itself.
Config.setVideoImageFormat("png");

// Limited-range 8-bit 4:2:0 in BT.709, which is what the reference clips are
// and what editors expect. Without this Remotion tags the output yuvj420p --
// full-range -- and levels shift depending on what opens the file.
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");

// Silent films. Left to itself Remotion writes a silent AAC track, which also
// pushed the duration to 10.048s instead of an exact 10.000s -- and an exact
// duration is the point for something built to loop.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

// The woven-texture compositions draw through PixiJS/WebGL. Headless Chrome has
// no GPU here, so route WebGL at ANGLE's SwiftShader backend -- "swangle" is the
// renderer that actually produces pixels in a container. Without this the WebGL
// context creation fails and the frames come out black.
Config.setChromiumOpenGlRenderer("swangle");
Config.overrideBundlerConfig(enableTailwind);

// Some sandboxed dev environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright Chromium at this path.
// Reuse it there instead of downloading; on a normal machine this path
// won't exist and Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
