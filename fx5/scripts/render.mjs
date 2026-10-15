// Renders 720p previews (PNG frames → H.264 via Remotion), a PNG still, and
// per-frame render timings. Usage: node scripts/render.mjs [Id ...] [--keep-frames]
import { bundle } from '@remotion/bundler';
import { renderFrames, renderStill, selectComposition, stitchFramesToVideo } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const keepFrames = args.includes('--keep-frames');
const SCALE = Number(process.env.SCALE ?? 0.3333333333333333);
const ids = args.filter((a) => !a.startsWith('--'));
const OUT = path.resolve('out/previews');
const FRAMES = path.resolve('out/frames');
fs.mkdirSync(OUT, { recursive: true });
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const base = {
  chromiumOptions: { gl: 'angle' },
  browserExecutable: fs.existsSync(browserExecutable) ? browserExecutable : null,
  timeoutInMilliseconds: 240000,
};
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const timingsFile = path.resolve('out/timings.json');
const timings = fs.existsSync(timingsFile) ? JSON.parse(fs.readFileSync(timingsFile, 'utf8')) : {};
const STILL_AT = { 'InkBloom': 300, 'FlarePass': 120 };

for (const id of ids) {
  const name = id.replace('-', '_');
  const composition = await selectComposition({ ...base, serveUrl, id, inputProps: {} });
  const dir = path.join(FRAMES, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const times = [];
  const t0 = Date.now();
  const { assetsInfo } = await renderFrames({
    ...base,
    serveUrl,
    composition,
    inputProps: {},
    outputDir: dir,
    imageFormat: 'png',
    scale: SCALE,
    concurrency: 3,
    onStart: () => undefined,
    onFrameUpdate: (_n, _f, ms) => times.push(ms),
  });
  const wall = (Date.now() - t0) / 1000;
  await stitchFramesToVideo({
    assetsInfo,
    fps: 30,
    width: Math.round(composition.width * SCALE),
    height: Math.round(composition.height * SCALE),
    outputLocation: path.join(OUT, `${name}.mp4`),
    codec: 'h264',
    crf: 16,
    pixelFormat: 'yuv420p',
    muted: true,
    force: true,
  });
  const prefix = Object.keys(STILL_AT).find((k) => name.startsWith(k));
  const stillFrame = prefix ? STILL_AT[prefix] : 300;
  fs.copyFileSync(
    path.join(dir, fs.readdirSync(dir).sort().find((f) => f.endsWith(`${String(stillFrame).padStart(3, '0')}.png`))),
    path.join(OUT, `${name}.png`),
  );
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  timings[name] = {
    frames: times.length,
    meanMsPerFrame: Math.round(mean),
    wallSecondsAtConcurrency3: Math.round(wall),
    effectiveMsPerFrame: Math.round((wall * 1000) / times.length),
  };
  fs.writeFileSync(timingsFile, JSON.stringify(timings, null, 2));
  console.log(name, timings[name]);
  // keep the middle frame of the full render for the determinism check
  const VER = path.resolve('out/verify');
  fs.mkdirSync(VER, { recursive: true });
  const mid = Math.floor(times.length / 2);
  const midFile = fs.readdirSync(dir).sort().find((f) => f.endsWith(`-${String(mid).padStart(3, '0')}.png`));
  fs.copyFileSync(path.join(dir, midFile), path.join(VER, `${name}_mid_full.png`));
  if (!keepFrames) fs.rmSync(dir, { recursive: true, force: true });
}
