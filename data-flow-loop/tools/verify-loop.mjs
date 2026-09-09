/**
 * Proves the loop is seamless.
 *
 * The `loop-check` composition is the same scene one frame longer than the
 * masters, so frame 600 can actually be rendered. Frame 600 must be identical
 * to frame 0 — every animated quantity is either a sin/cos of an integer
 * multiple of frame/600, or a wrap on the tile period, and the camera trucks
 * exactly one tile width.
 *
 *   node tools/verify-loop.mjs
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-'));
const scale = process.argv[2] ?? '0.5';

for (const frame of [0, 600]) {
  console.log(`rendering frame ${frame}...`);
  execFileSync(
    'npx',
    [
      'remotion',
      'still',
      'loop-check',
      path.join(dir, `${frame}.png`),
      `--frame=${frame}`,
      `--scale=${scale}`,
      '--log=error',
    ],
    {stdio: 'inherit'}
  );
}

const a = PNG.sync.read(fs.readFileSync(path.join(dir, '0.png')));
const b = PNG.sync.read(fs.readFileSync(path.join(dir, '600.png')));

let max = 0;
let sum = 0;
let n = 0;
for (let i = 0; i < a.data.length; i += 4) {
  for (let c = 0; c < 3; c++) {
    const d = Math.abs(a.data[i + c] - b.data[i + c]);
    if (d > max) max = d;
    sum += d;
    n++;
  }
}

console.log(`\nframe 0 vs frame 600 @ ${a.width}x${a.height}`);
console.log(`  max channel difference : ${max}/255`);
console.log(`  mean channel difference: ${(sum / n).toFixed(5)}`);
console.log(max === 0 ? '\n  SEAMLESS — frames are identical.' : '\n  NOT seamless.');
fs.rmSync(dir, {recursive: true, force: true});
process.exit(max === 0 ? 0 : 1);
