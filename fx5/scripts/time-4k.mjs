// Times single native-4K frames (scale 1). Usage: node scripts/time-4k.mjs Id:frame ...
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
const exe = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const base = { chromiumOptions: { gl: 'angle' }, browserExecutable: fs.existsSync(exe) ? exe : null, timeoutInMilliseconds: 600000 };
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const out = {};
for (const arg of process.argv.slice(2)) {
  const [id, frame] = arg.split(':');
  const composition = await selectComposition({ ...base, serveUrl, id, inputProps: {} });
  const dir = path.resolve('out/4k', id);
  fs.mkdirSync(dir, { recursive: true });
  const times = [];
  const t0 = Date.now();
  await renderFrames({ ...base, serveUrl, composition, inputProps: {}, outputDir: dir, imageFormat: 'png', scale: 1,
    concurrency: 1, frameRange: [Number(frame), Number(frame) + 1], onStart: () => undefined,
    onFrameUpdate: (_n, f, ms) => times.push({ f, ms }) });
  out[id] = { frames: times, wallSecondsIncludingInit: (Date.now() - t0) / 1000 };
  console.log(id, JSON.stringify(out[id]));
}
fs.writeFileSync('out/timings-4k.json', JSON.stringify(out, null, 2));
