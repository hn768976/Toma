import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Concurrency is deliberately left to the --concurrency CLI flag: it is capped at
// the machine's core count, so a value baked in here would fail on smaller boxes.

// The scene is one big <canvas>; give each frame room to bake sprites on cold start.
Config.setDelayRenderTimeoutInMilliseconds(120000);
