/**
 * Proves the 540-frame loop closes.
 *
 * Renders frame 0 and frame 540 of CodeFlythroughLoopCheck as lossless PNGs
 * and compares them byte for byte. Because every element's wrap cycle count is
 * a whole number over 540 frames, the camera sines have periods that divide
 * 540, and the grain is indexed by frame % 540, the two frames must be
 * identical.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';

const outDir = resolve('out/loop-check');
rmSync(outDir, {recursive: true, force: true});
mkdirSync(outDir, {recursive: true});

// Optional: point at an already-installed Chrome instead of Remotion's own.
const browser = process.env.REMOTION_BROWSER_EXECUTABLE;

const still = (frame, file) => {
  console.log(`rendering frame ${frame} ...`);
  execFileSync(
    'npx',
    [
      'remotion',
      'still',
      'CodeFlythroughLoopCheck',
      file,
      `--frame=${frame}`,
      '--image-format=png',
      '--log=error',
      ...(browser ? [`--browser-executable=${browser}`] : []),
    ],
    {stdio: 'inherit'},
  );
};

const a = resolve(outDir, 'frame-000.png');
const b = resolve(outDir, 'frame-540.png');

still(0, a);
still(540, b);

const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ha = hash(a);
const hb = hash(b);

console.log(`frame   0: ${ha}`);
console.log(`frame 540: ${hb}`);

if (ha === hb) {
  console.log('\nPASS - frame 0 and frame 540 are pixel-identical. Loop is seamless.');
  process.exit(0);
}

console.error('\nFAIL - frame 0 and frame 540 differ.');
process.exit(1);
