import { existsSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(100);
Config.setCodec('h264');
Config.setCrf(15);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);

// The 4K scene builds ~180 offscreen strip canvases on the first frame; give
// the delayRender() that guards it plenty of headroom.
Config.setDelayRenderTimeoutInMilliseconds(180_000);

// Canvas-heavy content: ANGLE is materially faster than the default renderer.
Config.setChromiumOpenGlRenderer('angle');

// Reuse a Chromium that is already on the machine instead of downloading one.
// It must be a chrome-headless-shell build: Remotion launches with the old
// headless flags, which a full Chrome binary now refuses.
const candidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
].filter(Boolean) as string[];
const browser = candidates.find((p) => existsSync(p));
if (browser) {
  Config.setBrowserExecutable(browser);
}
