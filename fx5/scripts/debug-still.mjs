import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
const [id, frame, out] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const opts = { serveUrl, chromiumOptions: { gl: 'angle' }, browserExecutable: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', onBrowserLog: (l) => console.log('[browser]', l.type, l.text) };
const composition = await selectComposition({ ...opts, id, inputProps: {} });
await renderStill({ ...opts, composition, frame: Number(frame), output: out, scale: 1 / 3 });
console.log('done');
