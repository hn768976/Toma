/**
 * Remotion CLI config. (The Node.js render APIs don't read this file — pass the
 * same options directly if you use them.)
 */
import { existsSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');

// WebGL2 in headless Chromium. 'angle' is required; see README.
Config.setChromiumOpenGlRenderer('angle');

// Lossless intermediate frames (JPEG would add its own banding/blocking to
// the grain and soft gradients).
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);

// H.264, yuv420p, CRF 16, no audio.
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
// Proper BT.709 matrix + tags (default would be untagged BT.601 conversion).
Config.setColorSpace('bt709');
Config.setMuted(true);

Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that ship Playwright's headless shell instead of
// allowing Remotion to download its own: reuse it. Elsewhere this path does
// not exist and Remotion uses its managed browser.
const pwShell = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(pwShell)) {
  Config.setBrowserExecutable(pwShell);
}
