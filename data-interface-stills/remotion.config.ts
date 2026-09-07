import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setStillImageFormat('png');
Config.overrideWebpackConfig((c) => c);
// Stills are one heavy synchronous canvas pass; give the page room to finish.
Config.setDelayRenderTimeoutInMilliseconds(240000);
Config.setChromiumDisableWebSecurity(false);
Config.setConcurrency(1);
