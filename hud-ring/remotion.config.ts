import { Config } from "@remotion/cli/config";

// PNG intermediates: the 2% grain that dithers the dark field is exactly the
// detail a JPEG intermediate would smear away.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// bt709 tags the stream limited-range, so it lands as yuv420p rather than the
// deprecated full-range yuvj420p that ffmpeg otherwise infers from the frames.
Config.setColorSpace("bt709");
// The scene is silent; no need for a padded audio track in the deliverable.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);
// Quality high enough that the near-black field does not band once encoded.
Config.setCrf(16);
Config.setOverwriteOutput(true);
// The scene is one large SVG; concurrency is capped to keep memory sane at 4K.
Config.setConcurrency(4);
