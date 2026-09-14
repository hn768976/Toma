/**
 * Renders every composition at full 4K, sharing one bundle across the batch.
 *
 * Doing this through 46 separate CLI invocations rebuilds the bundle each time;
 * this builds it once. renderMedia is deliberately left to open its own browser
 * pool - handing it a single shared instance pins it to one tab and costs more
 * than the launch saves.
 *
 * Usage:
 *   node scripts/render-all.mjs                       # all 46, 4K
 *   node scripts/render-all.mjs --scale=0.5           # 1080p previews
 *   node scripts/render-all.mjs --only=Poland,Indonesia
 *   node scripts/render-all.mjs --out=out/4k
 */
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
};
const outDir = flag('out', 'out');
const scale = Number(flag('scale', '1'));
const only = flag('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const browserExecutable = flag('browser-executable', undefined);

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
mkdirSync(path.resolve(root, outDir), {recursive: true});

const countries = JSON.parse(
  readFileSync(path.resolve(root, 'src/countries.ts'), 'utf8')
    .split('export const COUNTRIES: readonly Country[] = ')[1]
    .replace(/ as const;\s*$/, ''),
);

const jobs = [];
for (const country of countries) {
  const slug = country.name.replace(/[^A-Za-z0-9]/g, '');
  if (only.length && !only.includes(slug) && !only.includes(country.code)) continue;
  for (const suffix of ['Green', 'Blue']) {
    jobs.push({id: `${slug}-GlitchMap${suffix}`, file: `${slug}_GlitchMap${suffix}.mp4`});
  }
}

console.log(`Bundling for ${jobs.length} composition(s) at scale ${scale}...`);
const serveUrl = await bundle({entryPoint: path.resolve(root, 'src/index.ts')});

let failures = 0;
for (const job of jobs) {
  const started = Date.now();
  try {
    const composition = await selectComposition({serveUrl, id: job.id, browserExecutable});
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: path.resolve(root, outDir, job.file),
      scale,
      crf: 13,
      pixelFormat: 'yuv420p',
      colorSpace: 'bt709',
      muted: true,
      enforceAudioTrack: false,
      overwrite: true,
      browserExecutable,
    });
    const seconds = (Date.now() - started) / 1000;
    console.log(
      `ok   ${job.file}  ${seconds.toFixed(0)}s  (${(
        (seconds * 1000) /
        composition.durationInFrames
      ).toFixed(0)} ms/frame)`,
    );
  } catch (error) {
    failures++;
    console.error(`FAIL ${job.id}: ${error.message}`);
  }
}

console.log(`\n${jobs.length - failures}/${jobs.length} rendered into ${outDir}/`);
process.exit(failures === 0 ? 0 : 1);
