import { existsSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

// WebGL2 through ANGLE (not WebGPU). On a GPU machine this uses the GPU; with
// no GPU, Chromium falls back to SwiftShader inside ANGLE.
Config.setChromiumOpenGlRenderer('angle');
Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(16);
Config.setOverwriteOutput(true);
// The 8192 px map canvas + its mipmapped texture take ~1 GB per tab, so keep
// concurrency modest; raise it on big machines.
Config.setConcurrency(2);
// Drawing the map once per tab takes a while on CPU-only machines.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Sandboxed dev environments sometimes ship a Playwright headless shell here;
// on a normal machine this path doesn't exist and Remotion downloads its own.
const pw = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(pw)) {
	Config.setBrowserExecutable(pw);
}
