/**
 * Renders the still batch.
 *
 *   node scripts/render-batch.ts                 # the whole batch
 *   node scripts/render-batch.ts --only=amber    # only jobs whose name matches
 *   node scripts/render-batch.ts --concurrency=2
 *   node scripts/render-batch.ts --scale=0.25    # fast low-res proofs
 *   node scripts/render-batch.ts --force         # re-render existing files
 *
 * Set REMOTION_BROWSER_EXECUTABLE if Remotion cannot download its own browser.
 */
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {resolveBrowser} from './browser.ts';

type Job = {
  layout: string;
  palette: string;
  density: string;
  tilt: string;
};

const LAYOUTS = [
  'leftBinary',
  'centreStack',
  'scattered',
  'grid',
  'diagonalFlow',
  'dense',
];
const PALETTES = ['blue', 'cyan', 'green', 'amber', 'violet', 'red'];
const DENSITIES = ['sparse', 'medium', 'dense'];
const TILTS = ['left', 'right'];

/**
 * The two layouts that held up best across all six palettes, and the palette
 * each is rendered in for the density/tilt sweep.
 */
const STRONGEST: {layout: string; palette: string}[] = [
  {layout: 'dense', palette: 'cyan'},
  {layout: 'leftBinary', palette: 'blue'},
];

const OUT_DIR = join('out', 'stills');

/** Same parameters, same seed, same image — every time. */
const seedFor = (j: Job) => `${j.layout}-${j.palette}-${j.density}-${j.tilt}`;
const nameFor = (j: Job) =>
  `interface-${j.layout}-${j.palette}-${j.density}-${j.tilt}.png`;

const buildJobs = (): Job[] => {
  const jobs: Job[] = [];
  // 36: every layout in every palette, at the reference density and tilt.
  for (const layout of LAYOUTS) {
    for (const palette of PALETTES) {
      jobs.push({layout, palette, density: 'medium', tilt: 'right'});
    }
  }
  // 12: the two strongest layouts swept across densities and tilt directions.
  for (const {layout, palette} of STRONGEST) {
    for (const density of DENSITIES) {
      for (const tilt of TILTS) {
        jobs.push({layout, palette, density, tilt});
      }
    }
  }
  return jobs;
};

const arg = (flag: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${flag}=`))?.split('=').slice(1).join('=');

const render = (job: Job, extraArgs: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const props = JSON.stringify({
      seed: seedFor(job),
      palette: job.palette,
      layout: job.layout,
      tilt: job.tilt,
      density: job.density,
    });
    const args = [
      'remotion',
      'still',
      'DataInterface',
      join(OUT_DIR, nameFor(job)),
      `--props=${props}`,
      '--log=error',
      ...extraArgs,
    ];
    const child = spawn('npx', args, {stdio: ['ignore', 'ignore', 'inherit']});
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${nameFor(job)} exited ${code}`)),
    );
  });

const main = async () => {
  mkdirSync(OUT_DIR, {recursive: true});

  const only = arg('only');
  const force = process.argv.includes('--force');
  const concurrency = Number(arg('concurrency') ?? 3);
  const scale = arg('scale');

  const extraArgs: string[] = [];
  const browser = resolveBrowser();
  if (browser) extraArgs.push(`--browser-executable=${browser}`);
  if (scale) extraArgs.push(`--scale=${scale}`);

  // Two cells of the density/tilt sweep (medium + right) are, by definition,
  // already in the 6x6 grid. Rendering them twice would just overwrite the same
  // file with the same image, so the batch de-duplicates by output name.
  const seen = new Set<string>();
  const jobs = buildJobs().filter((j) => {
    const name = nameFor(j);
    if (seen.has(name)) return false;
    seen.add(name);
    return only ? name.includes(only) : true;
  });

  const pending = jobs.filter((j) => force || !existsSync(join(OUT_DIR, nameFor(j))));
  console.log(
    `${jobs.length} stills in batch, ${pending.length} to render, concurrency ${concurrency}`,
  );

  let index = 0;
  let done = 0;
  const failures: string[] = [];
  const worker = async () => {
    for (;;) {
      const job = pending[index++];
      if (!job) return;
      try {
        await render(job, extraArgs);
      } catch (err) {
        failures.push(`${nameFor(job)}: ${(err as Error).message}`);
      }
      done += 1;
      console.log(`[${done}/${pending.length}] ${nameFor(job)}`);
    }
  };
  await Promise.all(Array.from({length: Math.max(1, concurrency)}, worker));

  if (failures.length) {
    console.error(`\n${failures.length} failed:\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log(`\nDone. ${jobs.length} stills in ${OUT_DIR}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
