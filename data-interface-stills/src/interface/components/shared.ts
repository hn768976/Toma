import type {Palette} from '../palettes';
import {alpha} from '../palettes';
import type {Rng} from '../rng';
import type {Bucket} from '../plane';
import type {DensitySpec, Rect} from '../types';
import {monoFont} from '../draw';

export type BlockProps = {
  rect: Rect;
  palette: Palette;
  rng: Rng;
  density: DensitySpec;
  /** Per-region content scale multiplier. */
  scale: number;
  bucket: Bucket;
  z: number;
};

export const BINARY_CHARS = '01';
export const CODE_CHARS = '0123456789ABCDEF';

/**
 * Rows of tightly set monospace characters. Shared by <BinaryBlock> and the
 * interior of <LabelledPanel>. Every character is fictional filler.
 */
export const drawCharRows = (
  ctx: CanvasRenderingContext2D,
  r: Rect,
  p: Palette,
  rng: Rng,
  opts: {
    fontSize: number;
    charset?: string;
    /** Fraction of rows that run the block's full width. */
    fullRowChance?: number;
    /** Number of short, visibly highlighted runs. */
    highlightRuns?: number;
    /** Weights for [dim, mid, bright]. */
    toneWeights?: readonly [number, number, number];
    tracking?: number;
  },
): void => {
  const {
    fontSize,
    charset = BINARY_CHARS,
    fullRowChance = 0.45,
    highlightRuns = 0,
    toneWeights = [0.22, 0.63, 0.15] as const,
    tracking = 1.02,
  } = opts;

  ctx.font = monoFont(fontSize);
  const charW = ctx.measureText('0').width * tracking;
  const lineH = fontSize * 1.24;
  const rows = Math.floor(r.h / lineH);
  const cols = Math.floor(r.w / charW);
  if (rows < 1 || cols < 1) return;

  // Row length varies — uniform rows read as a printed grid, not as data.
  const grid: number[][] = [];
  const chars: string[][] = [];
  for (let y = 0; y < rows; y++) {
    const len = rng.next() < fullRowChance
      ? cols
      : Math.max(3, Math.round(cols * rng.range(0.22, 0.94)));
    const tones: number[] = [];
    const cs: string[] = [];
    for (let x = 0; x < len; x++) {
      tones.push(rng.weighted(toneWeights));
      cs.push(charset[Math.floor(rng.next() * charset.length)]);
    }
    grid.push(tones);
    chars.push(cs);
  }

  // A few short runs read as though something in the stream was flagged.
  const highlights: {row: number; from: number; to: number}[] = [];
  for (let i = 0; i < highlightRuns; i++) {
    const row = rng.int(0, rows - 1);
    const len = Math.min(grid[row].length, rng.int(4, 14));
    if (grid[row].length - len < 1) continue;
    const from = rng.int(0, grid[row].length - len);
    highlights.push({row, from, to: from + len});
    for (let x = from; x < from + len; x++) grid[row][x] = 2;
  }

  ctx.textBaseline = 'top';
  for (const h of highlights) {
    ctx.fillStyle = alpha(p.border, 0.22);
    ctx.fillRect(
      r.x + h.from * charW - charW * 0.12,
      r.y + h.row * lineH - lineH * 0.05,
      (h.to - h.from) * charW + charW * 0.24,
      lineH * 0.98,
    );
  }

  // Batch consecutive characters that share a tone into one fillText.
  for (let y = 0; y < rows; y++) {
    const tones = grid[y];
    const cs = chars[y];
    let start = 0;
    while (start < tones.length) {
      let end = start + 1;
      while (end < tones.length && tones[end] === tones[start]) end += 1;
      ctx.fillStyle = alpha(p.tones[tones[start]], tones[start] === 0 ? 0.8 : 0.95);
      ctx.fillText(cs.slice(start, end).join(''), r.x + start * charW, r.y + y * lineH);
      start = end;
    }
  }
  ctx.textBaseline = 'alphabetic';
};

/** A jagged 0..1 profile used by charts and waveforms. */
export const jaggedProfile = (rng: Rng, n: number, smooth: number): number[] => {
  const out: number[] = [];
  const amp = 1 - smooth;
  let v = rng.range(0.3, 0.7);
  for (let i = 0; i < n; i++) {
    const spike = rng.next() < 0.12 ? rng.range(-0.5, 0.5) : rng.range(-0.16, 0.16);
    v += spike * amp;
    v = Math.max(0.04, Math.min(0.96, v + rng.range(-0.1, 0.1) * amp));
    out.push(v);
  }
  return out;
};
