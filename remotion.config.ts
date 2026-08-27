import {existsSync} from 'node:fs';
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
// No watermark, no audio.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');

// This machine has no egress to remotion.media, so Remotion cannot fetch its
// own Chrome Headless Shell. Point it at the Chromium that ships with the
// image instead. Set REMOTION_BROWSER_EXECUTABLE to override.
// Remotion launches with old-headless flags, so use the headless-shell build
// rather than the full Chromium, which no longer supports them.
const candidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium',
].filter(Boolean) as string[];

const browser = candidates.find((c) => existsSync(c));
if (browser) {
  Config.setBrowserExecutable(browser);
}
