import {existsSync} from 'node:fs';
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
// The piece is silent - without this every render carries an empty AAC track.
Config.setMuted(true);
Config.setChromiumOpenGlRenderer('angle');

// This machine has no egress to Remotion's Chrome download host, so point the
// renderer at the Chromium that ships with the image.
const LOCAL_CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(LOCAL_CHROME)) {
	Config.setBrowserExecutable(LOCAL_CHROME);
}
Config.setDelayRenderTimeoutInMilliseconds(120000);
