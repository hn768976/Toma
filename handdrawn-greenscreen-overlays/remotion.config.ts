import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(16);
Config.setChromiumOpenGlRenderer('angle');
Config.setMuted(true);
Config.setDelayRenderTimeoutInMilliseconds(120000);
// Keyframe every 0.5 s: H.264 skip-blocks can otherwise carry a faint ghost of
// erased ink (±3 levels) into the clean-green tail. I-frames reset it.
Config.overrideFfmpegCommand(({ type, args }) => {
  if (type !== 'stitcher') return args;
  const out = args[args.length - 1];
  return [...args.slice(0, -1), '-g', '15', out];
});
