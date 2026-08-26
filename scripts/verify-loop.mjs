/**
 * Loop verification.
 *
 * The composition is 744 frames and must be a seamless loop, which means the
 * frame *after* the last one has to be pixel-identical to frame 0. Remotion
 * will not render frame 744 of a 744-frame composition, so the composition's
 * duration is overridden to 745 here purely for the check — the registered
 * composition is untouched.
 *
 *   node scripts/verify-loop.mjs [CompositionId ...]
 */
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const CHROME =
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = existsSync(CHROME) ? CHROME : null;

const ids = process.argv.slice(2);
const targets = ids.length ? ids : ['CandleMacroBear', 'CandleMacroBull'];

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

const serveUrl = await bundle({entryPoint: join(process.cwd(), 'src/index.ts')});
const dir = await mkdtemp(join(tmpdir(), 'loopcheck-'));

let ok = true;
for (const id of targets) {
  const composition = await selectComposition({
    serveUrl,
    id,
    inputProps: {},
    browserExecutable,
  });
  const {durationInFrames} = composition;
  // one frame past the end, so frame N is the wrap of frame 0
  const probe = {...composition, durationInFrames: durationInFrames + 1};

  const shots = [];
  for (const frame of [0, durationInFrames]) {
    const output = join(dir, `${id}-${frame}.png`);
    await renderStill({
      composition: probe,
      serveUrl,
      output,
      frame,
      imageFormat: 'png',
      browserExecutable,
      // full 4K backing store; scale only affects the screenshot size
      scale: 1,
    });
    shots.push(await readFile(output));
  }

  const [a, b] = shots;
  const identical = a.length === b.length && a.equals(b);
  ok &&= identical;
  console.log(
    `${identical ? 'PASS' : 'FAIL'}  ${id}: frame 0 vs frame ${durationInFrames}`
  );
  console.log(`      frame 0   sha256 ${sha(a)}`);
  console.log(`      frame ${durationInFrames} sha256 ${sha(b)}`);
}

await rm(dir, {recursive: true, force: true});
process.exit(ok ? 0 : 1);
