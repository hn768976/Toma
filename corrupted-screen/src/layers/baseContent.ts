import { chance, hash, rand, randInt, randPow, seedOf } from "../lib/rand";
import { Theme, withAlpha } from "../lib/theme";

/**
 * Layer 1: a dim, mostly illegible field of interface-like debris. Fragments of
 * rows, small blocks, dashed rules, tiny text shaped smears. This is texture,
 * not content - it should suggest a UI that has been destroyed rather than one
 * that can be read.
 */

const ROW = seedOf("base/row");
const CELL = seedOf("base/cell");
const SMEAR = seedOf("base/smear");
const RULE = seedOf("base/rule");
const BOX = seedOf("base/box");
const FLICKER = seedOf("base/flicker");

const ROW_COUNT = 96;

type RowKind = 0 | 1 | 2 | 3;

const rowKind = (i: number): RowKind => {
  const v = hash(ROW, i, 7);
  if (v < 0.42) return 0; // text smear
  if (v < 0.7) return 1; // cell run
  if (v < 0.87) return 2; // dashed rule
  return 3; // outlined box
};

const debrisColor = (theme: Theme, i: number, alpha: number): string => {
  const v = hash(ROW, i, 11);
  if (v < 0.08) return withAlpha(theme.accents[randInt(0, theme.accents.length, ROW, i, 12)], alpha * 0.8);
  if (v < 0.34) return withAlpha(theme.mid, alpha * 0.75);
  if (v < 0.62) return withAlpha(theme.deep, alpha);
  return `rgba(150, 150, 165, ${alpha * 0.55})`;
};

const drawTextSmear = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  glyphHeight: number,
  seed: number,
  color: string,
) => {
  ctx.fillStyle = color;
  const advance = glyphHeight * 0.72;
  const count = Math.max(3, Math.floor(width / advance));
  for (let g = 0; g < count; g++) {
    if (chance(0.18, SMEAR, seed, g)) continue; // gaps read as missing glyphs
    const w = advance * rand(0.4, 0.72, SMEAR, seed, g, 1);
    const h = glyphHeight * rand(0.6, 1, SMEAR, seed, g, 2);
    ctx.fillRect(x + g * advance, y + (glyphHeight - h), w, h);
  }
};

/**
 * The static half of the debris field. Same every frame, so the eye reads it as
 * a surface rather than as noise.
 */
export const drawBaseStatic = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: Theme,
) => {
  for (let i = 0; i < ROW_COUNT; i++) {
    const y = rand(-0.02, 1.0, ROW, i, 1) * height;
    const x = rand(-0.06, 0.86, ROW, i, 2) * width;
    const w = randPow(0.05, 0.62, 1.5, ROW, i, 3) * width;
    const h = randPow(0.004, 0.032, 1.8, ROW, i, 4) * height;
    const alpha = rand(0.07, 0.3, ROW, i, 5);
    const color = debrisColor(theme, i, alpha);
    const kind = rowKind(i);

    if (kind === 0) {
      drawTextSmear(ctx, x, y, w, h * 0.5, i, color);
      continue;
    }

    if (kind === 1) {
      ctx.fillStyle = color;
      const cells = randInt(2, 9, CELL, i);
      let cx = x;
      for (let c = 0; c < cells; c++) {
        const cw = w * rand(0.05, 0.24, CELL, i, c);
        if (!chance(0.22, CELL, i, c, 1)) {
          ctx.fillRect(cx, y, cw, h);
        }
        cx += cw + w * 0.018;
      }
      continue;
    }

    if (kind === 2) {
      ctx.fillStyle = color;
      const thickness = Math.max(2, h * 0.18);
      const dash = w * rand(0.02, 0.09, RULE, i);
      const gap = dash * rand(0.35, 1.2, RULE, i, 1);
      for (let dx = 0; dx < w; dx += dash + gap) {
        ctx.fillRect(x + dx, y, Math.min(dash, w - dx), thickness);
      }
      continue;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, h * 0.12);
    ctx.strokeRect(x, y, w, h * rand(1.4, 4.5, BOX, i));
  }
};

/**
 * A handful of rows that breathe. Keyed on the frame so they still loop, and
 * kept dim - the loud element is the block layer, not this.
 */
export const drawBaseFlicker = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: Theme,
  frame: number,
  level: number,
) => {
  const COUNT = 44;
  for (let i = 0; i < COUNT; i++) {
    const hold = 3 + (i % 4); // 3..6, all divide 600
    const slot = Math.floor(frame / hold);
    if (hash(FLICKER, i, slot) > 0.3 + level * 0.4) continue;

    const y = rand(0, 1, FLICKER, i, 1) * height;
    const x = rand(-0.05, 0.9, FLICKER, i, 2) * width;
    const w = randPow(0.04, 0.4, 1.6, FLICKER, i, slot, 3) * width;
    const h = randPow(0.003, 0.018, 1.7, FLICKER, i, 4) * height;
    const alpha = rand(0.14, 0.42, FLICKER, i, slot, 5);
    drawTextSmear(ctx, x, y, w, h, i + 900 + slot, withAlpha(theme.mid, alpha));
  }
};
