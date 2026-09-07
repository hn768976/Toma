/**
 * Tiles every still in out/stills into a single contact sheet.
 *
 *   node scripts/contact-sheet.ts
 *   node scripts/contact-sheet.ts --cols=8 --tile=420
 *
 * Uses the same headless browser as the renders: the sheet is laid out as a
 * page and screenshotted, so there is no image-processing dependency.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {resolveBrowser} from './browser.ts';

const arg = (flag: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${flag}=`))?.split('=')[1];

const STILLS = resolve('out', 'stills');
const OUT = resolve(arg('out') ?? join('out', 'contact-sheet.png'));
const COLS = Number(arg('cols') ?? 8);
const TILE = Number(arg('tile') ?? 460);
const TILE_H = Math.round((TILE * 9) / 16);
const LABEL = 20;

const main = () => {
  const browser = resolveBrowser();
  if (!browser) {
    console.error(
      'No browser found. Set REMOTION_BROWSER_EXECUTABLE to a Chromium binary.',
    );
    process.exit(1);
  }

  const files = readdirSync(STILLS)
    .filter((f) => f.endsWith('.png'))
    .sort();
  if (!files.length) {
    console.error(`No stills in ${STILLS} — run scripts/render-batch.ts first.`);
    process.exit(1);
  }

  const cells = files
    .map((f) => {
      const caption = f.replace(/^interface-/, '').replace(/\.png$/, '');
      return `<figure><img src="file://${join(STILLS, f)}"><figcaption>${caption}</figcaption></figure>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; background: rgb(8, 9, 12); }
    main { display: grid; grid-template-columns: repeat(${COLS}, ${TILE}px); gap: 8px; padding: 8px; }
    figure { margin: 0; }
    img { width: ${TILE}px; height: ${TILE_H}px; display: block; }
    figcaption { font: 11px/${LABEL}px ui-monospace, "DejaVu Sans Mono", monospace;
      color: rgb(159, 180, 204); height: ${LABEL}px; overflow: hidden; white-space: nowrap; }
  </style></head><body><main>${cells}</main></body></html>`;

  mkdirSync(resolve('out'), {recursive: true});
  const page = resolve('out', 'contact-sheet.html');
  writeFileSync(page, html);

  const rows = Math.ceil(files.length / COLS);
  const width = COLS * (TILE + 8) + 8;
  const height = rows * (TILE_H + LABEL + 8) + 16;

  const res = spawnSync(
    browser,
    [
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      `--screenshot=${OUT}`,
      `--window-size=${width},${height}`,
      `file://${page}`,
    ],
    {encoding: 'utf8'},
  );
  if (res.status !== 0) {
    console.error(res.stderr);
    process.exit(1);
  }
  console.log(`${files.length} stills tiled ${COLS}x${rows} -> ${OUT}`);
};

main();
