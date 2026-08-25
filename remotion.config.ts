import { Config } from '@remotion/cli/config';

// Lossless intermediate frames — the finish is all low-alpha additive passes
// and a JPEG round-trip would eat the grain and the fringe before encoding.
Config.setVideoImageFormat('png');

// Codec, ProRes profile and pixel format are left to the CLI. Pinning a ProRes
// profile here makes every non-ProRes render fail outright.

// The canvas is drawn imperatively, so Remotion's default of scaling the
// preview does not apply — always capture the full 3840×2160 backing store.
Config.setScale(1);

// A single 4K frame builds three depth planes plus a bloom pass; give the page
// room before Remotion decides it has stalled.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Use a Chromium already on the machine when one is present. Remotion
// otherwise downloads its own Headless Shell on first render, which needs
// egress to remotion.media.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
