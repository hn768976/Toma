/**
 * Renders every version to a 1080p H.264 deliverable.
 *
 * The masters registered in Root.tsx are 3840x2160; the `-1080p` entries are
 * the same component at delivery size, so switching this script to the 4K ids
 * (or passing --scale) produces the 4K masters with no other change.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { VERSIONS } from './versions.mjs';

const CHROME =
  process.env.REMOTION_CHROME ??
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const RES = process.argv.includes('--4k') ? '' : '-1080p';
const OUT = RES ? 'out/1080p' : 'out/4k';
mkdirSync(OUT, { recursive: true });

const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const list = only ? VERSIONS.filter((v) => v.id.includes(only)) : VERSIONS;

for (const [i, v] of list.entries()) {
  const started = Date.now();
  process.stdout.write(`[${i + 1}/${list.length}] ${v.id} … `);
  execFileSync(
    'npx',
    [
      'remotion', 'render', `${v.id}${RES}`, `${OUT}/${v.id}.mp4`,
      '--codec=h264',
      '--crf=16',
      '--pixel-format=yuv420p',
      '--image-format=png',
      '--color-space=bt709',
      '--gl=angle-egl',
      `--browser-executable=${CHROME}`,
      '--log=error',
      '--concurrency=2',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  console.log(`${((Date.now() - started) / 1000).toFixed(0)}s`);
}
