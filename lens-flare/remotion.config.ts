import { Config } from "@remotion/cli/config";

/**
 * The flare is drawn by a WebGL fragment shader, so the renderer needs a
 * working GL backend. "swangle" is SwiftShader-via-ANGLE: software GL that
 * behaves identically on machines with and without a GPU, which is what we
 * want for a plate that has to match between a preview render and a 4K one.
 */
Config.setChromiumOpenGlRenderer("swangle");

// PNG intermediates: the piece is almost entirely large, very soft gradients,
// and JPEG intermediates put visible blocking into them before x264 ever sees
// the frame.
Config.setVideoImageFormat("png");

Config.setCodec("h264");
Config.setPixelFormat("yuv420p");

// Low CRF so the encoder does not lift the black or band the falloffs.
Config.setCrf(14);

// This is a picture-only plate. setMuted drops the audio track entirely;
// setEnforceAudioTrack(false) on its own still leaves a silent AAC stream.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

Config.setOverwriteOutput(true);
