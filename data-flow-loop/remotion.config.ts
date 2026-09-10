import {Config} from '@remotion/cli/config';

// Lossless intermediate frames. The scene lives almost entirely in the bottom
// quarter of the range, where JPEG's default quality 80 costs a mean of ~2/255
// with peaks of 80/255 — visible as blocking around the hairlines. PNG is no
// slower here and the encoder stops wasting bitrate on compression artifacts.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Background plate: no audio track at all, not a silent one.
Config.setMuted(true);
// Software GL via ANGLE/SwiftShader — required for headless three.js rendering.
Config.setChromiumOpenGlRenderer('swangle');
Config.setConcurrency(4);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Use a locally-installed Chromium when one is provided (CI / sandboxes with
// no egress to remotion.media). Falls back to Remotion's own download.
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
