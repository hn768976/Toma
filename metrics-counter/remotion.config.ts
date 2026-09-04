/**
 * Note: when using the Node.js APIs the config file does not apply — pass the
 * options directly instead. All options: https://remotion.dev/docs/config
 */
import {existsSync} from 'node:fs';
import {Config} from '@remotion/cli/config';

// PNG intermediates rather than JPEG: the MJPEG pipe is full-range and makes
// ffmpeg tag the output yuvj420p, and it costs nothing here because the render
// is bound by Chrome rasterising the blur stack, not by the encode.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);
// The compositions are silent; without this Remotion attaches a silent AAC track.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
Config.setOverwriteOutput(true);

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it there;
// on a normal machine the path does not exist and Remotion falls back to its
// own managed browser.
const playwrightHeadlessShell =
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
