import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
// Dust re-randomises every frame, which is expensive for inter-frame
// compression. A low CRF keeps the specks hard-edged instead of smearing
// them into grey mush that would grey down the footage underneath.
Config.setCrf(13);
Config.setChromiumOpenGlRenderer('angle');
// These are picture-only plates: no silent AAC track in the output.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
Config.setOverwriteOutput(true);
