/**
 * Proves every cut's loop closes.
 *
 * For each variant, renders frame 0 and frame N of its LoopCheck composition
 * as lossless PNGs and compares them byte for byte. Because every element's
 * wrap cycle count is a whole number over the cut's length, the camera sines
 * have periods that divide it, the hero stop redistributes time within a
 * crossing without adding any, and the grain is indexed by frame % length, the
 * two frames must be identical.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';

const CUTS = [
  {composition: 'CodeFlythroughLoopCheck', frames: 540},
  {composition: 'CodeFlythroughBlueLoopCheck', frames: 780},
];

const outDir = resolve('out/loop-check');
rmSync(outDir, {recursive: true, force: true});
mkdirSync(outDir, {recursive: true});

// Optional: point at an already-installed Chrome instead of Remotion's own.
const browser = process.env.REMOTION_BROWSER_EXECUTABLE;

const still = (composition, frame, file) => {
  execFileSync(
    'npx',
    [
      'remotion',
      'still',
      composition,
      file,
      `--frame=${frame}`,
      '--image-format=png',
      '--log=error',
      ...(browser ? [`--browser-executable=${browser}`] : []),
    ],
    {stdio: 'inherit'},
  );
};

const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

let failed = false;

for (const {composition, frames} of CUTS) {
  console.log(`\n${composition}: rendering frame 0 and frame ${frames} ...`);
  const a = resolve(outDir, `${composition}-000.png`);
  const b = resolve(outDir, `${composition}-${frames}.png`);
  still(composition, 0, a);
  still(composition, frames, b);

  const ha = hash(a);
  const hb = hash(b);
  console.log(`  frame   0: ${ha}`);
  console.log(`  frame ${frames}: ${hb}`);
  if (ha === hb) {
    console.log(`  PASS - pixel-identical, loop is seamless.`);
  } else {
    console.error(`  FAIL - frame 0 and frame ${frames} differ.`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
