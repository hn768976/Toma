/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

Config.setRspack(true);
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// The PixiJS MeshRope layer needs WebGL2 in headless Chrome.
// "swangle" (ANGLE on SwiftShader, CPU) works everywhere, including servers
// without a GPU or X display. On a desktop with a GPU you can pass --gl=angle
// (or set REMOTION_GL=angle) for faster renders; the CLI flag overrides this.
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as 'swangle' | 'angle' | 'egl' | 'vulkan' | undefined) ?? 'swangle',
);

const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
Config.setChromiumFlags({
  // Newer Chrome only falls back to software WebGL when explicitly allowed.
  'enable-unsafe-swiftshader': true,
  // Sandboxed environments that only allow egress through an HTTPS proxy:
  // Remotion launches Chrome with --no-proxy-server, so route it through the
  // proxy explicitly (Google Fonts must load). Skipped when HTTPS_PROXY is unset.
  ...(proxy
    ? { 'no-proxy-server': false, 'proxy-server': proxy, 'proxy-bypass-list': '<local>;localhost;127.0.0.1' }
    : {}),
});

// Optional: REMOTION_BROWSER=/path/to/chrome-headless-shell to use a local browser.
// When unset, Remotion downloads its own Chrome Headless Shell on first render.
const localShell = process.env.REMOTION_BROWSER ?? '';
if (localShell && existsSync(localShell)) {
  Config.setBrowserExecutable(localShell);
}

