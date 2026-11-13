import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(1);
// Each frame redraws tens of thousands of street segments; give slow (CPU) GL time.
Config.setDelayRenderTimeoutInMilliseconds(180000);
