import {random} from 'remotion';
import {
  BLOCK_HEIGHT,
  COLUMNS,
  COL_CHARS,
  FONT_SIZE,
  HEIGHT,
  LINE_HEIGHT,
  MARGIN_X,
  ROWS,
  WIDTH,
} from './constants';
import {clamp01, createBuffer, ctx2d, mixHex, randRange, withAlpha} from './draw';
import {generateTerminalLines, TerminalLine} from './terminal-text';
import {monoFont} from '../fonts';
import type {VariantConfig} from '../variants';

export type TextBuffer = {
  canvas: HTMLCanvasElement;
  /** Left edge of each column, in 4K pixels. */
  colX: number[];
  charWidth: number;
  /** [column][row] content, so a corrupted band can be repainted in place. */
  grid: TerminalLine[][];
};

const columnLayout = (charWidth: number): number[] => {
  const colWidth = COL_CHARS * charWidth;
  const available = WIDTH - MARGIN_X * 2;
  const gutter = (available - colWidth * COLUMNS) / (COLUMNS - 1);
  return Array.from({length: COLUMNS}, (_, i) => MARGIN_X + i * (colWidth + gutter));
};

const lineColour = (palette: VariantConfig['palette'], weight: number, seed: string): string => {
  // Seeded per-line variation on top of the structural weight is what stops the
  // page reading as a flat grey and gives it texture under the wash.
  // The background sits between the two text tones, so a line that lands near
  // the middle of the mix vanishes. Push every line to one side or the other:
  // that is what makes the page read as darker and lighter striations.
  const w = clamp01(weight + randRange(-0.16, 0.16, seed));
  const t = w < 0.45 ? w * 0.3 : 0.58 + (w - 0.45) * 0.76;
  return mixHex(palette.textDark, palette.textLight, t);
};

/**
 * The terminal page is laid out exactly once. Sixty rows of monospace at 4K is
 * far too expensive to re-lay-out per frame — every frame just blits this.
 */
export const buildTextBuffer = (cfg: VariantConfig): TextBuffer => {
  const measure = ctx2d(createBuffer(8, 8));
  measure.font = monoFont(FONT_SIZE);
  const charWidth = measure.measureText('M').width;
  const colX = columnLayout(charWidth);

  const stream = generateTerminalLines(ROWS * COLUMNS, cfg.name);
  const grid: TerminalLine[][] = [];
  for (let c = 0; c < COLUMNS; c++) grid.push(stream.slice(c * ROWS, (c + 1) * ROWS));

  const canvas = createBuffer(WIDTH, BLOCK_HEIGHT);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = cfg.palette.textBg;
  ctx.fillRect(0, 0, WIDTH, BLOCK_HEIGHT);
  ctx.textBaseline = 'alphabetic';

  for (let c = 0; c < COLUMNS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const l = grid[c][r];
      if (!l.text) continue;
      const seed = `${cfg.name}-line-${c}-${r}`;
      ctx.font = monoFont(FONT_SIZE, random(`${seed}-bold`) < 0.12 ? 700 : 400);
      ctx.fillStyle = lineColour(cfg.palette, l.weight, seed);
      ctx.fillText(l.text, colX[c], r * LINE_HEIGHT + FONT_SIZE);
    }
  }

  return {canvas, colX, charWidth, grid};
};

/**
 * The wash is not flat. This texture carries the fine horizontal striations, the
 * vertical lift toward the upper third, and a few low-contrast vertical streaks.
 * It is built once and drawn over the flat flood at a per-frame opacity.
 */
export const buildWashTexture = (cfg: VariantConfig): HTMLCanvasElement => {
  const {palette} = cfg;
  const canvas = createBuffer(WIDTH, HEIGHT);
  const ctx = ctx2d(canvas);

  // Fine horizontal striations, like a badly tuned CRT.
  let y = 0;
  let i = 0;
  while (y < HEIGHT) {
    const band = 2 + Math.floor(random(`${cfg.name}-band-${i}`) * 5);
    const roll = random(`${cfg.name}-bandv-${i}`);
    if (roll < 0.46) {
      ctx.fillStyle = withAlpha(palette.washDeep, 0.06 + random(`${cfg.name}-bd-${i}`) * 0.3);
      ctx.fillRect(0, y, WIDTH, band);
    } else if (roll < 0.62) {
      ctx.fillStyle = withAlpha(palette.bannerWhite, 0.015 + random(`${cfg.name}-bl-${i}`) * 0.05);
      ctx.fillRect(0, y, WIDTH, band);
    }
    y += band;
    i++;
  }

  // Irregular vertical streaks, low contrast.
  for (let s = 0; s < 16; s++) {
    const sx = random(`${cfg.name}-sx-${s}`) * WIDTH;
    const sw = 40 + random(`${cfg.name}-sw-${s}`) * 240;
    const dark = random(`${cfg.name}-sc-${s}`) < 0.6;
    const grad = ctx.createLinearGradient(sx, 0, sx + sw, 0);
    const col = dark ? palette.washDeep : palette.bannerWhite;
    const a = dark ? 0.09 : 0.035;
    grad.addColorStop(0, withAlpha(col, 0));
    grad.addColorStop(0.5, withAlpha(col, a));
    grad.addColorStop(1, withAlpha(col, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(sx, 0, sw, HEIGHT);
  }

  // Subtle vertical gradient, brighter toward the upper third.
  const lift = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  lift.addColorStop(0, withAlpha(palette.bannerWhite, 0.05));
  lift.addColorStop(0.28, withAlpha(palette.bannerWhite, 0.09));
  lift.addColorStop(0.62, withAlpha(palette.bannerWhite, 0));
  lift.addColorStop(1, withAlpha(palette.washDeep, 0.16));
  ctx.fillStyle = lift;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  return canvas;
};

/** 4px scanline period at ~5% alpha, drawn as a tiled pattern. */
export const buildScanlineTile = (cfg: VariantConfig): HTMLCanvasElement => {
  const c = createBuffer(1, 4);
  const ctx = ctx2d(c);
  ctx.fillStyle = withAlpha(cfg.palette.bannerBlack, 0.05);
  ctx.fillRect(0, 0, 1, 1);
  return c;
};
