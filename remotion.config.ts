import {existsSync} from 'node:fs';
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// No audio in this piece.
Config.setMuted(true);
Config.setChromiumOpenGlRenderer('angle');

// Some sandboxes cannot reach Remotion's Chrome download host. Fall back to a
// browser that is already on the machine when one is available.
const browser =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  [
    '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ].find((p) => existsSync(p));

if (browser) {
  Config.setBrowserExecutable(browser);
}
