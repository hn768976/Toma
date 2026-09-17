/**
 * Renders a still from EVERY composition and lays them out as contact sheets.
 *
 * A composition nobody looked at fails silently in an unattended 4K batch, so
 * this is the check that each flag's ratio, colours and orientation are right
 * across all 60 — the same pass you would make by opening them in the studio,
 * but reviewable as three images and repeatable in CI.
 */
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {chromium} from 'playwright-core';
import {readFileSync, mkdirSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'src/data/countries.json'), 'utf8'));
const OUT = process.env.SHEET_DIR ?? join(root, 'out/contact');
const SCALE = 0.14; // 538x302 per tile — enough to read ratio, colour and orientation
const FRAME = 95;
const browserExecutable = process.env.CHROME_EXECUTABLE ?? null;

if (existsSync(OUT)) rmSync(OUT, {recursive: true});
mkdirSync(OUT, {recursive: true});

console.log('bundling...');
const serveUrl = await bundle({entryPoint: join(root, 'src/index.ts')});

const versions = [
  {suffix: 'FlagPole', framing: 'pole'},
  {suffix: 'FlagCloseup', framing: 'closeup'},
];
const tiles = [];
let n = 0;
const total = data.countries.length * versions.length;

for (const c of data.countries) {
  for (const v of versions) {
    const id = `${c.slug}-${v.suffix}`;
    const composition = await selectComposition({
      serveUrl,
      id,
      browserExecutable,
      chromiumOptions: {gl: 'swangle'},
      inputProps: {countryCode: c.code, framing: v.framing},
    });
    const output = join(OUT, `${id}.png`);
    await renderStill({
      composition,
      serveUrl,
      output,
      frame: FRAME,
      scale: SCALE,
      imageFormat: 'png',
      chromiumOptions: {gl: 'swangle'},
      browserExecutable,
      inputProps: {countryCode: c.code, framing: v.framing},
    });
    tiles.push({id, file: `${id}.png`, label: `${c.name} ${c.ratio[0]}:${c.ratio[1]} — ${v.suffix}`});
    n++;
    console.log(`${String(n).padStart(2)}/${total}  ${id}`);
  }
}

// Lay the tiles out as sheets that can actually be looked at.
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const PER_SHEET = 20;
for (let s = 0; s * PER_SHEET < tiles.length; s++) {
  const slice = tiles.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
  const html = `<body style="margin:0;background:#161616;display:flex;flex-wrap:wrap;font-family:system-ui">
${slice
  .map(
    (t) =>
      `<div style="width:25%;box-sizing:border-box;padding:5px">
         <img src="${t.file}" style="width:100%;display:block;background:#000">
         <div style="color:#ddd;font-size:11px;padding-top:3px">${t.label}</div>
       </div>`,
  )
  .join('')}
</body>`;
  writeFileSync(join(OUT, `_sheet${s}.html`), html);
  const page = await browser.newPage({viewport: {width: 1500, height: 1200}});
  await page.goto(`file://${join(OUT, `_sheet${s}.html`)}`, {waitUntil: 'load'});
  await page.screenshot({path: join(OUT, `sheet-${s + 1}.png`), fullPage: true});
  await page.close();
  console.log(`sheet-${s + 1}.png`);
}
await browser.close();
console.log(`\n${tiles.length} compositions rendered to ${OUT}`);
