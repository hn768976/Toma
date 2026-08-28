import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
// Smooth blurred gradients on a near-black background band easily. Keep the
// intermediate frames close to lossless so the only quantisation is the encoder's.
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
// The piece has no audio; without this Remotion muxes in a silent track.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
