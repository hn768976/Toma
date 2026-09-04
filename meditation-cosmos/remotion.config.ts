import { existsSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

// PNG intermediates rather than JPEG. These compositions are almost entirely
// large, smooth gradients, which is exactly what JPEG blocks up — and the
// full-range JPEG pipeline also made x264 tag the output yuvj420p rather than
// the yuv420p these files are meant to carry.
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
// Smooth nebula gradients band in H.264; a low CRF plus the grain layer keeps
// the sky clean. Judge this on the encoded file, never on the studio preview.
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
// Silent motion backgrounds; do not attach an empty audio track.
Config.setEnforceAudioTrack(false);
Config.setCodec('h264');
// 'angle' uses the GPU where there is one and falls back to a software
// backend where there is not. Remotion's Linux default, 'swangle', pins the
// software path and rasterised these 4K layered compositions about seven times
// slower for a pixel-identical result.
Config.setChromiumOpenGlRenderer('angle');

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Reuse it there; on a normal machine
// this path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
