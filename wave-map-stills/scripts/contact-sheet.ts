/**
 * Tiles the 24 rendered stills into out/contact-sheet.png at reduced scale,
 * four across and six down, so each composition's two palettes sit side by
 * side (c01 pair, c02 pair / c03 pair, c04 pair / ...).
 *
 *   node --experimental-strip-types scripts/contact-sheet.ts
 * Or, via package.json:  npm run contact-sheet
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {PNG} from "pngjs";
import {jobs} from "./batch.ts";
import {hexToRgb} from "../src/lib/color.ts";
import {PALETTES} from "../src/lib/palettes.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stillsDir = join(root, "out", "stills");
const outFile = join(root, "out", "contact-sheet.png");

const COLS = 4;
const TILE_W = 640;
const GAP = 12;

/** Box-filter downscale — good enough for a contact sheet and dependency-free. */
const downscale = (src: PNG, w: number, h: number): PNG => {
  const dst = new PNG({width: w, height: h});
  const sx = src.width / w;
  const sy = src.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.min(src.height, Math.max(y0 + 1, Math.floor((y + 1) * sy)));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.min(src.width, Math.max(x0 + 1, Math.floor((x + 1) * sx)));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        let i = (yy * src.width + x0) * 4;
        for (let xx = x0; xx < x1; xx++, i += 4) {
          r += src.data[i];
          g += src.data[i + 1];
          b += src.data[i + 2];
          n++;
        }
      }
      const o = (y * w + x) * 4;
      dst.data[o] = r / n;
      dst.data[o + 1] = g / n;
      dst.data[o + 2] = b / n;
      dst.data[o + 3] = 255;
    }
  }
  return dst;
};

const queue = jobs();
const missing = queue.filter((j) => !existsSync(join(stillsDir, j.name)));
if (missing.length > 0) {
  throw new Error(
    `Missing ${missing.length} still(s), e.g. ${missing[0].name}. Run the batch first.`,
  );
}

const first = PNG.sync.read(readFileSync(join(stillsDir, queue[0].name)));
const tileH = Math.round((TILE_W * first.height) / first.width);
const rows = Math.ceil(queue.length / COLS);
const sheet = new PNG({
  width: COLS * TILE_W + (COLS + 1) * GAP,
  height: rows * tileH + (rows + 1) * GAP,
});

// Gutter colour: the deepest background in the set.
const gutter = hexToRgb(PALETTES.slate.bgDeep);
for (let i = 0; i < sheet.data.length; i += 4) {
  sheet.data[i] = gutter[0];
  sheet.data[i + 1] = gutter[1];
  sheet.data[i + 2] = gutter[2];
  sheet.data[i + 3] = 255;
}

queue.forEach((job, k) => {
  const src = PNG.sync.read(readFileSync(join(stillsDir, job.name)));
  const tile = downscale(src, TILE_W, tileH);
  const ox = (k % COLS) * (TILE_W + GAP) + GAP;
  const oy = Math.floor(k / COLS) * (tileH + GAP) + GAP;
  for (let y = 0; y < tileH; y++) {
    for (let x = 0; x < TILE_W; x++) {
      const i = (y * TILE_W + x) * 4;
      const o = ((y + oy) * sheet.width + (x + ox)) * 4;
      sheet.data[o] = tile.data[i];
      sheet.data[o + 1] = tile.data[i + 1];
      sheet.data[o + 2] = tile.data[i + 2];
      sheet.data[o + 3] = 255;
    }
  }
  console.log(`  placed ${job.name}`);
});

writeFileSync(outFile, PNG.sync.write(sheet));
console.log(`Contact sheet: out/contact-sheet.png (${sheet.width}x${sheet.height})`);
