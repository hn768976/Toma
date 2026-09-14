/**
 * Opens every one of the 46 compositions and renders a frame from each beat of
 * the build sequence, so no composition ships unlooked-at.
 *
 * Usage: node scripts/verify-all.mjs [outDir] [--scale=0.25] [--frames=45,130,200,340]
 *
 * One bundle and one browser are shared across all of them, which is the whole
 * point - the CLI would pay for both 184 times over.
 */
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
};
const outDir = args.find((a) => !a.startsWith('--')) ?? 'out/verify';
const scale = Number(flag('scale', '0.25'));
const frames = flag('frames', '45,130,200,340').split(',').map(Number);
const browserExecutable = flag('browser-executable', undefined);

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
mkdirSync(path.resolve(root, outDir), {recursive: true});

console.log('Bundling...');
const serveUrl = await bundle({entryPoint: path.resolve(root, 'src/index.ts')});

// The country list is read straight out of the data file, and the composition
// ids are derived exactly as Root.tsx derives them.
const data = JSON.parse(
  readFileSync(path.resolve(root, 'src/countries.ts'), 'utf8')
    .split('export const COUNTRIES: readonly Country[] = ')[1]
    .replace(/ as const;\s*$/, ''),
);
const ids = [];
for (const country of data) {
  const slug = country.name.replace(/[^A-Za-z0-9]/g, '');
  ids.push({id: `${slug}-GlitchMapGreen`, country}, {id: `${slug}-GlitchMapBlue`, country});
}

const browser = await openBrowser('chrome', {browserExecutable});
let failures = 0;
const started = Date.now();

for (const {id} of ids) {
  try {
    const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser});
    for (const frame of frames) {
      await renderStill({
        composition,
        serveUrl,
        output: path.resolve(root, outDir, `${id}_f${frame}.png`),
        frame,
        scale,
        puppeteerInstance: browser,
        overwrite: true,
      });
    }
    console.log(`ok   ${id}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${id}: ${error.message}`);
  }
}

await browser.close({silent: true});
console.log(
  `\n${ids.length - failures}/${ids.length} compositions rendered, ${frames.length} frames each, in ${(
    (Date.now() - started) /
    1000
  ).toFixed(0)}s`,
);
process.exit(failures === 0 ? 0 : 1);
