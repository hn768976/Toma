import { Config } from '@remotion/cli/config';

// PNG rather than JPEG for the frame intermediate: the JPEG path tags the
// output yuvj420p (full range), which lifts blacks in editors that honour the
// flag, and its chroma subsampling bands the wide gradients these scenes are
// mostly made of.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle-egl');
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(120000);
