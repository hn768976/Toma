import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);
// No audio anywhere in this project — keep it out of the container entirely.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);
Config.setChromiumOpenGlRenderer('angle');

// Optional escape hatch for environments where Remotion cannot download its own
// Chrome Headless Shell (locked-down CI, restricted egress). Unset by default.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
Config.setConcurrency(2);
Config.setOverwriteOutput(true);
