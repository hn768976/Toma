/**
 * Remotion CLI config for the Flag Map template.
 * (When using the Node.js APIs this file does not apply; pass the same
 * options directly.)
 */
import {existsSync} from 'node:fs';
import {Config} from '@remotion/cli/config';

// WebGL2 in headless Chromium: ANGLE (falls back to SwiftShader on machines
// without a GPU). Equivalent to passing --gl=angle on the command line.
Config.setChromiumOpenGlRenderer('angle');

// Lossless frames into the encoder: JPEG frames would add blocking on the
// large smooth floor gradient before x264 even sees it.
Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(16);
// Video only: no (silent) audio stream.
Config.setMuted(true);
Config.setOverwriteOutput(true);
// Each tab holds a WebGL context plus 4K render targets; keep tabs modest.
Config.setConcurrency(4);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that ship a Playwright headless shell instead of
// letting Remotion download its own Chrome. On a normal machine this path
// does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
