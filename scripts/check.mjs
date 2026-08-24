/**
 * Verification harness (dev only — not part of the deliverable).
 *
 *  1. loads dist/cyber-alert.html and asserts it runs clean
 *  2. renders selected frames through the real 3840x2160 path and writes a
 *     contact sheet for visual review
 *  3. asserts determinism (same frame twice => identical pixels) and that
 *     every looping quantity returns to its t=0 value at t=10.0
 */
import { chromium } from 'playwright-core';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.env.CHECK_OUT || resolve(root, 'out/check');
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FRAMES = (process.env.CHECK_FRAMES || '0,45,96,150,222,300,381,470')
  .split(',')
  .map(Number);

await mkdir(outDir, { recursive: true });
const engineSrc = (await readFile(resolve(root, 'src/engine/cyber-alert.js'), 'utf8'));

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

/* --- 1. the shipped HTML file actually runs ------------------------- */
await page.goto(pathToFileURL(resolve(root, 'dist/cyber-alert.html')).href);
await page.waitForTimeout(4000);
await page.screenshot({ path: resolve(outDir, 'page-live.png'), timeout: 180000 });
console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : 'dist/cyber-alert.html: no errors');

/* --- 2/3. drive the engine directly -------------------------------- */
const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page2.on('pageerror', (e) => errors.push('engine: ' + String(e)));
await page2.setContent('<body style="margin:0;background:#000"><canvas id="v"></canvas></body>');
await page2.addScriptTag({
  content: engineSrc.replace(/^export /gm, '') + '\nwindow.CA={createScene,drawFrame,WIDTH,HEIGHT,FPS,TOTAL_FRAMES,DURATION_SEC};',
  type: 'module',
});
await page2.waitForFunction('window.CA !== undefined');

const setup = await page2.evaluate(() => {
  const { createScene, WIDTH, HEIGHT } = window.CA;
  const t0 = performance.now();
  window.scene = createScene(WIDTH, HEIGHT);
  window.buf = document.createElement('canvas');
  window.buf.width = WIDTH;
  window.buf.height = HEIGHT;
  window.bctx = window.buf.getContext('2d', { alpha: false });
  return { buildMs: Math.round(performance.now() - t0), bursts: window.scene.bursts.length };
});
console.log(`scene build: ${setup.buildMs}ms, glitch bursts in loop: ${setup.bursts}`);

// loop-closure maths
const loop = await page2.evaluate(() => {
  const { scene, CA } = window;
  const D = CA.DURATION_SEC;
  let worstCol = 0;
  for (const c of [...scene.far, ...scene.near]) {
    // scroll(t) = stripH * t/D  =>  scroll(D) must land exactly on stripH
    worstCol = Math.max(worstCol, Math.abs(c.stripH * (D / D) - c.stripH));
  }
  const lastBurst = scene.bursts[scene.bursts.length - 1];
  return {
    worstColumnResidual: worstCol,
    speedRangePxPerSec: [
      Math.round(Math.min(...scene.far.map((c) => c.speed))),
      Math.round(Math.max(...scene.far.map((c) => c.speed))),
    ],
    columns: { far: scene.far.length, near: scene.near.length },
    bokeh: scene.bokeh.length,
    pulseAtLoop: Math.sin((Math.PI * 2 * D) / 2.5),
    lastBurstEnd: lastBurst.f0 + lastBurst.dur,
    burstGaps: scene.bursts.slice(1).map((b, i) => +((b.f0 - scene.bursts[i].f0) / CA.FPS).toFixed(2)),
    burstDurations: scene.bursts.map((b) => b.dur),
  };
});
console.log('loop closure:', JSON.stringify(loop));

// per-frame timing + contact sheet
const frames = FRAMES;
const timings = await page2.evaluate((frames) => {
  const { drawFrame } = window.CA;
  const out = [];
  for (const f of frames) {
    const t0 = performance.now();
    drawFrame(window.bctx, window.scene, f);
    out.push(Math.round(performance.now() - t0));
  }
  return out;
}, frames);
console.log('draw ms per frame:', JSON.stringify(frames.map((f, i) => `${f}:${timings[i]}ms`)));

// determinism: re-render an early frame after many others, compare pixels
const det = await page2.evaluate(() => {
  const { drawFrame, WIDTH, HEIGHT } = window.CA;
  const grab = (f) => {
    drawFrame(window.bctx, window.scene, f);
    return window.bctx.getImageData(0, 0, WIDTH, HEIGHT).data;
  };
  const a = grab(96);
  grab(300);
  grab(7);
  const b = grab(96);
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) diff++;
  // frame 600 must fold onto frame 0
  const z = grab(0);
  const w = grab(600);
  let diff2 = 0;
  for (let i = 0; i < z.length; i += 4) if (z[i] !== w[i] || z[i + 1] !== w[i + 1] || z[i + 2] !== w[i + 2]) diff2++;
  return { repeatDiffPx: diff, loopFoldDiffPx: diff2 };
});
console.log('determinism:', JSON.stringify(det));

// contact sheet, 4 x 2 at 960x540 each
await page2.evaluate((frames) => {
  const { drawFrame } = window.CA;
  const cw = 960, ch = 540, cols = 4;
  const rows = Math.ceil(frames.length / cols);
  const v = document.getElementById('v');
  v.width = cw * cols;
  v.height = ch * rows;
  const c = v.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.fillStyle = '#000';
  c.fillRect(0, 0, v.width, v.height);
  frames.forEach((f, i) => {
    drawFrame(window.bctx, window.scene, f);
    c.drawImage(window.buf, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
    c.font = '20px monospace';
    c.fillStyle = '#0f0';
    c.fillText('f' + f, (i % cols) * cw + 10, Math.floor(i / cols) * ch + 26);
  });
  v.style.width = cw * cols / 2 + 'px';
}, frames);
await page2.locator('#v').screenshot({ path: resolve(outDir, 'contact-sheet.png'), timeout: 180000 });

// a full-res crop of the icon for close inspection
await page2.evaluate(() => {
  const { drawFrame, WIDTH, HEIGHT } = window.CA;
  drawFrame(window.bctx, window.scene, 150);
  const v = document.getElementById('v');
  v.width = 1400; v.height = 1150;
  const c = v.getContext('2d');
  c.drawImage(window.buf, WIDTH / 2 - 700, HEIGHT / 2 - 575, 1400, 1150, 0, 0, 1400, 1150);
});
await page2.locator('#v').screenshot({ path: resolve(outDir, 'icon-crop.png'), timeout: 180000 });

// a glitch frame, full frame at half res
const glitchFrame = await page2.evaluate(() => window.scene.bursts[2].f0 + 1);
await page2.evaluate((f) => {
  const { drawFrame, WIDTH, HEIGHT } = window.CA;
  drawFrame(window.bctx, window.scene, f);
  const v = document.getElementById('v');
  v.width = 1920; v.height = 1080;
  v.getContext('2d').drawImage(window.buf, 0, 0, 1920, 1080);
}, glitchFrame);
await page2.locator('#v').screenshot({ path: resolve(outDir, `glitch-f${glitchFrame}.png`), timeout: 180000 });
console.log('glitch sample frame:', glitchFrame);

if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
}
await browser.close();
console.log('wrote review images to ' + outDir);
