import { makeRand } from "../../lib/random";

// Matrix and strand layout, generated once at module level from fixed seeds.

export const COLS = 200;
export const ROWS = 120;
export const DX = 0.5; // column spacing
export const DZ = 0.55; // row spacing (runs into the distance, -z)
export const STRAND_COUNT = 300;
export const ROW_DELAY = 0.45; // frames per row as a column fills

const rand = makeRand(4063);

/** Column x positions; gap columns (data-column separators) are null. */
export const columns: (number | null)[] = (() => {
  const out: (number | null)[] = [];
  let run = 0;
  let runLen = rand.int(3, 8);
  for (let c = 0; c < COLS; c++) {
    if (run === runLen) {
      out.push(null);
      run = 0;
      runLen = rand.int(2, 9);
    } else {
      out.push((c - COLS / 2 + 0.5) * DX);
      run++;
    }
  }
  return out;
})();

export const activeCols = columns
  .map((x, i) => (x === null ? -1 : i))
  .filter((i) => i >= 0);

const HALF_W = (COLS / 2) * DX;
const SEED_BLOCK = 10; // |x| below this: pre-lit block at the start

/** Frame each column starts lighting (when its first strand lands). */
export const colLand: number[] = columns.map((x) => {
  if (x === null) return 1e9;
  const ax = Math.abs(x);
  if (ax < SEED_BLOCK) return -40;
  return 70 + 140 * Math.pow((ax - SEED_BLOCK) / (HALF_W - SEED_BLOCK), 0.85) + rand.range(-8, 8);
});

export type Strand = {
  p0: [number, number, number];
  p1: [number, number, number];
  p2: [number, number, number];
  p3: [number, number, number];
  start: number;
  dur: number;
  accent: number;
  bright: number;
};

export const strands: Strand[] = (() => {
  const out: Strand[] = [];
  for (let i = 0; i < STRAND_COUNT; i++) {
    const ci = i < activeCols.length ? activeCols[i] : rand.pick(activeCols);
    const x = columns[ci] as number;
    const land = Math.max(colLand[ci], 55) + (i < activeCols.length ? 0 : rand.range(0, 40));
    const dur = rand.range(62, 92);
    const x0 = x * rand.range(0.35, 0.8) + rand.range(-14, 14);
    const z0 = rand.range(3, 16);
    const zApproach = rand.range(3, 8);
    out.push({
      p0: [x0, rand.range(42, 52), z0],
      p1: [x0 * 0.7 + x * 0.3, rand.range(9, 18), z0 * 0.8],
      p2: [x, rand.range(1.2, 3.0), zApproach],
      p3: [x, 0.0, 0.0],
      start: land - dur,
      dur,
      accent: rand.next() < 0.22 ? 1 : 0,
      bright: rand.range(0.45, 1.0),
    });
  }
  return out;
})();
