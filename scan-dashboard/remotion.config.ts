import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(16);
Config.setChromiumOpenGlRenderer('angle');
Config.setEntryPoint('./src/index.ts');
