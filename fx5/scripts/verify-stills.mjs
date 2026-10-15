// Cold-start stills for the verify loop:
//  - middle frame of each composition, each in a fresh browser (determinism)
//  - frames 0 and 600 of a 601-frame version of each loop (loop check)
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const ids = process.argv.slice(2);
const VER = path.resolve('out/verify');
fs.mkdirSync(VER, { recursive: true });
const exe = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = fs.existsSync(exe) ? exe : null;
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const LOOPS = ['NeuralPaths', 'Lightning', 'SpiralGalaxy'];

async function still(id, frame, output, inputProps = {}) {
  // a fresh browser per still = a cold start
  const puppeteerInstance = await openBrowser('chrome', { browserExecutable, chromiumOptions: { gl: 'angle' } });
  try {
    const opts = { serveUrl, puppeteerInstance, chromiumOptions: { gl: 'angle' }, browserExecutable, timeoutInMilliseconds: 240000 };
    const composition = await selectComposition({ ...opts, id, inputProps });
    await renderStill({ ...opts, composition, frame, output, inputProps, scale: 0.3333333333333333, imageFormat: 'png', overwrite: true });
  } finally {
    await puppeteerInstance.close({ silent: true });
  }
}

for (const id of ids) {
  const name = id.replace('-', '_');
  const frames = name.startsWith('InkBloom') ? 420 : name.startsWith('FlarePass') ? 240 : 600;
  await still(id, Math.floor(frames / 2), path.join(VER, `${name}_mid_cold.png`));
  if (LOOPS.some((l) => name.startsWith(l))) {
    await still(id, 0, path.join(VER, `${name}_f0.png`), { durationOverride: 601 });
    await still(id, 600, path.join(VER, `${name}_f600.png`), { durationOverride: 601 });
  }
  console.log('done', name);
}
