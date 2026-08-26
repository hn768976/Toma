import {existsSync} from 'fs';
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
// the piece has no audio; without this Remotion attaches a silent AAC track
Config.setMuted(true);
Config.setChromiumOpenGlRenderer('angle');

// This machine has Chromium pre-installed; Remotion's own download host is not
// reachable from here.
const localChrome = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(localChrome)) {
  Config.setBrowserExecutable(localChrome);
}
