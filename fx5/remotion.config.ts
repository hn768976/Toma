import { existsSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
Config.setOverwriteOutput(true);
// PixiJS needs a real WebGL2 context in headless Chromium.
Config.setChromiumOpenGlRenderer('angle');
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);

// Sandboxed environments without Remotion's Chrome Headless Shell download
// can reuse a Playwright Chromium; elsewhere Remotion uses its own browser.
const pw = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(pw)) Config.setBrowserExecutable(pw);
