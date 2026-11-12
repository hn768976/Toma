// Render a list of stills (bundle once) and optionally a labelled contact sheet.
//   node scripts/stills.mjs --frames=10,35,50 [--scale=0.5] [--out=out/stills] [--sheet=out/contact_sheet.png] [--cols=4]
// Uses the same Chrome settings as remotion.config.ts (swangle WebGL for PixiJS).
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const frames = (args.frames ?? '0').split(',').map(Number);
const scale = Number(args.scale ?? 0.5);
const outDir = args.out ?? 'out/stills';
fs.mkdirSync(outDir, { recursive: true });

const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const chromiumOptions = {
  gl: process.env.REMOTION_GL ?? 'swangle',
  flags: {
    'enable-unsafe-swiftshader': true,
    ...(proxy ? { 'no-proxy-server': false, 'proxy-server': proxy, 'proxy-bypass-list': '<local>;localhost;127.0.0.1' } : {}),
  },
};
const localShell = process.env.REMOTION_BROWSER ?? '';
const browserExecutable = localShell && fs.existsSync(localShell) ? localShell : null;

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const browser = await openBrowser('chrome', { browserExecutable, chromiumOptions });
const composition = await selectComposition({ serveUrl, id: 'SeaAbcPilot', puppeteerInstance: browser, chromiumOptions, browserExecutable });
const files = [];
for (const frame of frames) {
  const output = path.join(outDir, `f${String(frame).padStart(3, '0')}.png`);
  await renderStill({ composition, serveUrl, frame, output, scale, puppeteerInstance: browser, chromiumOptions, browserExecutable, overwrite: true });
  files.push({ frame, output });
  console.log('still', frame);
}
await browser.close({ silent: true });

if (args.sheet) {
  const cols = Number(args.cols ?? 4);
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const labelled = files.map(({ frame, output }) => {
    const l = output.replace('.png', '_lbl.png');
    const draw = fs.existsSync(font)
      ? `,drawbox=x=0:y=0:w=150:h=44:color=0x1D2B53@0.85:t=fill,drawtext=fontfile=${font}:text='f ${frame}':x=12:y=9:fontsize=26:fontcolor=white`
      : '';
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', output, '-vf', `scale=640:-1${draw}`, l]);
    return l;
  });
  const rows = Math.ceil(labelled.length / cols);
  const inputs = labelled.flatMap((l) => ['-i', l]);
  const n = labelled.length;
  const layout = labelled.map((_, i) => `${(i % cols) * 640 + (i % cols) * 8}_${Math.floor(i / cols) * 368}`).join('|');
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', ...inputs,
    '-filter_complex', `${labelled.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=${n}:layout=${layout}:fill=white${n < rows * cols ? '' : ''}[v]`,
    '-map', '[v]', '-frames:v', '1', args.sheet,
  ]);
  console.log('sheet', args.sheet);
}
