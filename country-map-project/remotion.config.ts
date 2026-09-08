import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setStillImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
// Frames are rendered as JPEG for speed, which otherwise leaves the output
// tagged full-range (yuvj420p). Declaring bt709 gives limited-range yuv420p with
// correct primaries — what an NLE expects.
Config.setColorSpace('bt709');
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
// The maps are large static SVG scenes and a 4K tab is memory-hungry; raise or
// lower with --concurrency on the render command to suit the machine.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Reuse a Chromium already present on the machine when one is nominated. Remotion
// downloads its own headless shell otherwise, which needs network access.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
