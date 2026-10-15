// All configuration options: https://remotion.dev/docs/config
import { existsSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

// WebGL2 in headless Chromium: ANGLE (falls back to SwiftShader without a GPU).
Config.setChromiumOpenGlRenderer('angle');
// Lossless intermediate frames: JPEG would add blocking and banding before the encoder.
Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
// WebGL renders can take a while per frame at 4K on a software GL.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one here. On a normal machine this path does
// not exist and Remotion uses its own managed browser.
const playwrightHeadlessShell = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
