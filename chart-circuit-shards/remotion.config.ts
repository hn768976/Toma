import { existsSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

// WebGL2 through ANGLE (required for headless Chromium to get a GL context).
Config.setChromiumOpenGlRenderer('angle');
// Lossless frames into the encoder: JPEG intermediates would add banding.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one here. Elsewhere this path does not exist and
// Remotion uses its own managed browser.
const playwrightHeadlessShell = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
