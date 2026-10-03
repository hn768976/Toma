// Remotion CLI config. https://remotion.dev/docs/config
import {existsSync} from 'node:fs';
import {Config} from '@remotion/cli/config';

// WebGL2 in headless Chromium: ANGLE (equivalent to --gl=angle).
Config.setChromiumOpenGlRenderer('angle');

// Lossless intermediate frames: JPEG frames would add their own banding.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setMuted(true);
Config.setOverwriteOutput(true);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright one; use it when present.
const playwrightHeadlessShell =
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
