/**
 * Framing check for every registered composition.
 *
 *   npm run check:framing              # all compositions
 *   npm run check:framing -- BRA CHL   # just these countries
 *
 * Renders each composition at its opening frame and at frame 340 (the closing
 * framing, fully built) and lays the pairs out as contact sheets in
 * out/checks/. This is the pass that catches a country sitting half out of
 * frame — a composition nobody looked at will fail silently in an unattended
 * 4K batch, and this makes looking at all of them cheap.
 */

import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderStill, openBrowser} from '@remotion/renderer';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Set REMOTION_BROWSER_EXECUTABLE to reuse a Chromium already on the machine
 *  instead of letting Remotion download its own headless shell. */
const BROWSER = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
const OUT = path.join(ROOT, 'out', 'checks');
const SCALE = 0.25;
const FRAMES = [0, 340];
const SHEET_COLS = 2;
const SHEET_ROWS = 3;

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));

const main = async () => {
  mkdirSync(OUT, {recursive: true});
  console.log('Bundling ...');
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'src', 'index.ts'),
    onProgress: () => undefined,
  });

  const all = await getCompositions(serveUrl, {browserExecutable: BROWSER});
  const comps = only.length
    ? all.filter((c) => only.some((code) => c.id.includes(code) || matchesCode(c, code)))
    : all;
  console.log(`${comps.length} compositions to check.\n`);

  const browser = await openBrowser('chrome', {
    chromiumOptions: {gl: 'angle'},
    browserExecutable: BROWSER,
  });

  const tiles: {id: string; frame: number; file: string}[] = [];
  for (const [i, comp] of comps.entries()) {
    for (const frame of FRAMES) {
      const file = path.join(OUT, `${comp.id}_f${frame}.png`);
      await renderStill({
        composition: comp,
        serveUrl,
        output: file,
        frame,
        scale: SCALE,
        imageFormat: 'png',
        puppeteerInstance: browser,
        overwrite: true,
        timeoutInMilliseconds: 120000,
      });
      tiles.push({id: comp.id, frame, file});
    }
    process.stdout.write(`\r  ${i + 1}/${comps.length}  ${comp.id}`.padEnd(70));
  }
  console.log('\n');
  await browser.close({silent: true});

  await buildSheets(tiles);
  writeFileSync(
    path.join(OUT, 'index.json'),
    JSON.stringify(tiles.map((t) => ({id: t.id, frame: t.frame})), null, 2)
  );
  console.log(`Contact sheets in ${path.relative(ROOT, OUT)}/`);
};

const matchesCode = (comp: {id: string}, code: string) =>
  comp.id.toUpperCase().includes(code.toUpperCase());

/** Lay the opening/closing pairs out six to a sheet, captioned. */
const buildSheets = async (tiles: {id: string; frame: number; file: string}[]) => {
  const tileW = Math.round(3840 * SCALE);
  const tileH = Math.round(2160 * SCALE);
  const pad = 10;
  const capH = 28;
  const cellW = tileW + pad;
  const cellH = tileH + capH + pad;
  const perSheet = SHEET_COLS * SHEET_ROWS;

  for (let s = 0; s * perSheet < tiles.length; s++) {
    const group = tiles.slice(s * perSheet, (s + 1) * perSheet);
    const sheetW = SHEET_COLS * cellW + pad;
    const sheetH = SHEET_ROWS * cellH + pad;
    const labels: string[] = [];
    const composites = group.map((t, i) => {
      const col = i % SHEET_COLS;
      const row = Math.floor(i / SHEET_COLS);
      const x = pad + col * cellW;
      const y = pad + row * cellH;
      labels.push(
        `<text x="${x + 4}" y="${y + tileH + 20}" font-family="monospace" font-size="16" fill="#e8e8e8">` +
          `${t.id}  ·  frame ${t.frame}</text>`
      );
      return {input: t.file, left: x, top: y};
    });
    const overlay = Buffer.from(
      `<svg width="${sheetW}" height="${sheetH}">${labels.join('')}</svg>`
    );
    await sharp({
      create: {
        width: sheetW,
        height: sheetH,
        channels: 3,
        background: {r: 24, g: 24, b: 26},
      },
    })
      .composite([...composites, {input: overlay, left: 0, top: 0}])
      .jpeg({quality: 82})
      .toFile(path.join(OUT, `sheet-${String(s + 1).padStart(2, '0')}.jpg`));
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
