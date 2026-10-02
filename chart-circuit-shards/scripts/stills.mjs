// Render selected frames of a composition to PNG (one browser, one bundle).
// usage: node scripts/stills.mjs <compId> <outDir> <frame,frame,...> [scale] [--loopCheck] [--bundle=dir]
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition, openBrowser } from '@remotion/renderer';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [id, outDir, framesArg, scaleArg] = process.argv.slice(2);
const loopCheck = process.argv.includes('--loopCheck');
const bundleArg = process.argv.find((a) => a.startsWith('--bundle='));
const scale = scaleArg && !scaleArg.startsWith('--') ? Number(scaleArg) : 0.3333333333333333;
const frames = framesArg.split(',').map(Number);
mkdirSync(outDir, { recursive: true });
const hs = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = existsSync(hs) ? hs : null;
const serveUrl = bundleArg
  ? bundleArg.slice('--bundle='.length)
  : await bundle({ entryPoint: path.resolve('src/index.ts') });
const chromiumOptions = { gl: 'angle' };
const browser = await openBrowser('chrome', { browserExecutable, chromiumOptions });
const inputProps = loopCheck ? { loopCheck } : {};
const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser, chromiumOptions, browserExecutable });
for (const f of frames) {
  const t0 = performance.now();
  await renderStill({
    composition,
    serveUrl,
    frame: f,
    output: path.join(outDir, `${id}_${String(f).padStart(4, '0')}.png`),
    imageFormat: 'png',
    scale,
    inputProps,
    puppeteerInstance: browser,
    chromiumOptions,
    browserExecutable,
    overwrite: true,
    timeoutInMilliseconds: 180000,
    onBrowserLog: process.env.BROWSER_LOG ? (l) => console.log('[browser]', l.text) : undefined,
  });
  console.log(`frame ${f}: ${((performance.now() - t0) / 1000).toFixed(2)}s`);
}
await browser.close({ silent: true });
