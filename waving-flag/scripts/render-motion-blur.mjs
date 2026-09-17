/**
 * Renders a composition with motion blur.
 *
 * Remotion has no built-in shutter sampling, so the blur is produced the
 * straightforward way: the composition is rendered several times, each pass
 * offset by a fraction of a frame via the `shutterOffset` input prop, and the
 * passes are averaged frame by frame. Because `shutterOffset` only shifts the
 * sampled time — every wave term is still a pure function of it — the passes
 * stay deterministic and can be rendered out of order like any other.
 *
 * A 180-degree shutter (SHUTTER_ANGLE = 0.5) means the samples span half a
 * frame interval, centred on the frame's own time.
 *
 *   node scripts/render-motion-blur.mjs Japan-FlagPole out/Japan_FlagPole.mp4 --scale=0.5
 */
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, out] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const arg = (name, def) => {
  const f = flags.find((x) => x.startsWith(`--${name}=`));
  return f ? f.split('=')[1] : def;
};

if (!id || !out) {
  console.error('usage: render-motion-blur.mjs <CompositionId> <out.mp4> [--scale=0.5] [--samples=3] [--fps=30]');
  process.exit(1);
}

const scale = arg('scale', '1');
const samples = Number(arg('samples', '3'));
const fps = Number(arg('fps', '30'));
const shutter = Number(arg('shutter', '0.5'));
const concurrency = arg('concurrency', '4');

const work = join(root, '.motionblur', id);
rmSync(work, {recursive: true, force: true});
mkdirSync(work, {recursive: true});

// --- 1. render one pass per sub-frame sample --------------------------------
const offsets = Array.from({length: samples}, (_, i) => ((i + 0.5) / samples - 0.5) * shutter);
console.log(`sub-frame offsets: ${offsets.map((o) => o.toFixed(4)).join(', ')}`);

for (let i = 0; i < samples; i++) {
  const dir = join(work, `pass${i}`);
  mkdirSync(dir, {recursive: true});
  console.log(`pass ${i + 1}/${samples} (offset ${offsets[i].toFixed(4)} frames)...`);
  execFileSync(
    'npx',
    [
      'remotion', 'render', 'src/index.ts', id, dir,
      '--sequence', '--image-format=png',
      `--scale=${scale}`, `--concurrency=${concurrency}`,
      '--props', JSON.stringify({shutterOffset: offsets[i]}),
    ],
    {cwd: root, stdio: ['ignore', 'ignore', 'inherit']},
  );
}

// --- 2. average the passes frame by frame -----------------------------------
const frames = readdirSync(join(work, 'pass0'))
  .filter((f) => f.endsWith('.png'))
  .map((f) => Number(f.match(/(\d+)\.png$/)[1]))
  .sort((a, b) => a - b);
console.log(`averaging ${frames.length} frames across ${samples} passes...`);

const avgDir = join(work, 'avg');
mkdirSync(avgDir, {recursive: true});

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
await page.goto('about:blank');

for (const n of frames) {
  const datas = [];
  for (let i = 0; i < samples; i++) {
    const p = join(work, `pass${i}`, `element-${n}.png`);
    datas.push('data:image/png;base64,' + readFileSync(p).toString('base64'));
  }
  const dataUrl = await page.evaluate(async (srcs) => {
    const imgs = await Promise.all(
      srcs.map((s) => new Promise((r) => {
        const i = new Image();
        i.onload = () => r(i);
        i.src = s;
      })),
    );
    const cv = document.createElement('canvas');
    cv.width = imgs[0].width;
    cv.height = imgs[0].height;
    const ctx = cv.getContext('2d');
    // Draw each pass at 1/N opacity: an even average over the shutter.
    ctx.drawImage(imgs[0], 0, 0);
    for (let i = 1; i < imgs.length; i++) {
      ctx.globalAlpha = 1 / (i + 1);
      ctx.drawImage(imgs[i], 0, 0);
    }
    ctx.globalAlpha = 1;
    return cv.toDataURL('image/png');
  }, datas);
  writeFileSync(
    join(avgDir, `f${String(n).padStart(5, '0')}.png`),
    Buffer.from(dataUrl.split(',')[1], 'base64'),
  );
  if (n % 50 === 0) console.log(`  frame ${n}`);
}
await browser.close();

// --- 3. encode ---------------------------------------------------------------
if (existsSync(join(root, out))) rmSync(join(root, out));
console.log('encoding...');
execFileSync(
  'npx',
  [
    'remotion', 'ffmpeg', '-y', '-v', 'error',
    '-framerate', String(fps),
    '-start_number', String(frames[0]),
    '-i', join(avgDir, 'f%05d.png'),
    '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
    '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart',
    '-an',                       // no audio track, ever
    join(root, out),
  ],
  {cwd: root, stdio: 'inherit'},
);

rmSync(work, {recursive: true, force: true});
console.log(`wrote ${out}`);
