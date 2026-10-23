import {
  beam,
  dot,
  fermata,
  flags,
  flat,
  noteHead,
  stem,
  stemX,
  trebleClef,
} from "../shared/notation";

// Glyph sprites are drawn at a fixed staff space and then pre-blurred at a
// few levels, so per-frame rendering is only drawImage calls.
export const SPRITE_S = 56;
export const BLUR_LEVELS = [0, 3, 8, 16, 30] as const;

type Draw = (ctx: CanvasRenderingContext2D, s: number) => void;

const single = (up: boolean, filled: boolean, flagCount: number, dotted = false): Draw =>
  (ctx, s) => {
    const y = up ? 1.6 * s : -1.6 * s;
    noteHead(ctx, 0, y, s, filled);
    const sx = stemX(0, s, up);
    const tip = up ? y - 3.5 * s : y + 3.5 * s;
    stem(ctx, sx, y, tip, s);
    if (flagCount) flags(ctx, sx, tip, s, up, flagCount);
    if (dotted) dot(ctx, 1.1 * s, y - 0.2 * s, s);
  };

const beamed = (count: number, double: boolean, slope: number, triplet = false): Draw =>
  (ctx, s) => {
    const gap = 1.9 * s;
    const x0 = (-(count - 1) * gap) / 2;
    const heads = Array.from({ length: count }, (_, i) => 1.8 * s - ((i * slope) / Math.max(1, count - 1)) * s + (i % 2 ? 0.5 * s : 0));
    const beamY0 = Math.min(...heads) - 3.3 * s;
    for (let i = 0; i < count; i++) {
      const x = x0 + i * gap;
      noteHead(ctx, x, heads[i], s, true);
      const sx = stemX(x, s, true);
      const by = beamY0 - (i * slope * 0.4 * s) / Math.max(1, count - 1);
      stem(ctx, sx, heads[i], by, s);
    }
    const fx = stemX(x0, s, true);
    const lx = stemX(x0 + (count - 1) * gap, s, true);
    beam(ctx, fx - 0.06 * s, beamY0, lx + 0.06 * s, beamY0 - slope * 0.4 * s, s);
    if (double) beam(ctx, fx - 0.06 * s, beamY0 + 0.8 * s, lx + 0.06 * s, beamY0 + 0.8 * s - slope * 0.4 * s, s);
    if (triplet) {
      const ty = beamY0 - 1.0 * s;
      const mid = (fx + lx) / 2;
      ctx.fillRect(fx, ty, mid - 0.5 * s - fx, 0.09 * s);
      ctx.fillRect(mid + 0.5 * s, ty, lx - mid - 0.5 * s, 0.09 * s);
      ctx.fillRect(fx, ty, 0.09 * s, 0.5 * s);
      ctx.fillRect(lx - 0.09 * s, ty, 0.09 * s, 0.5 * s);
      ctx.font = `italic ${1.3 * s}px serif`;
      ctx.textAlign = "center";
      ctx.fillText("3", mid, ty + 0.45 * s);
      ctx.textAlign = "start";
    }
  };

const fermataNote = (filled: boolean): Draw => (ctx, s) => {
  const y = 1.2 * s;
  noteHead(ctx, 0, y, s, filled);
  const sx = stemX(0, s, false);
  stem(ctx, sx, y, y + 3.4 * s, s);
  fermata(ctx, 0.0, y - 1.5 * s, s);
};

export const GLYPHS: Draw[] = [
  single(true, true, 0),
  single(false, true, 0),
  single(true, true, 1),
  single(true, true, 2),
  single(true, false, 0),
  single(false, false, 0),
  single(true, true, 0, true),
  beamed(2, false, 0.6),
  beamed(2, true, -0.4),
  beamed(3, false, 0.3, true),
  beamed(4, true, 0.8),
  beamed(3, false, -0.6),
  fermataNote(false),
  fermataNote(true),
  (ctx, s) => trebleClef(ctx, -1.3 * s, 2 * s, s * 0.85),
  (ctx, s) => flat(ctx, -0.4 * s, 0, s * 1.1),
];

// Relative probability of each glyph appearing.
export const GLYPH_WEIGHTS = [6, 4, 5, 3, 4, 3, 2, 5, 3, 3, 2, 2, 4, 3, 2, 2];

export type SpriteSet = { canvases: HTMLCanvasElement[][]; size: number };

export const buildSprites = (ink: string): SpriteSet => {
  const s = SPRITE_S;
  const size = Math.round(12 * s);
  const canvases = GLYPHS.map((draw) =>
    BLUR_LEVELS.map((blur) => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = ink;
      if (blur > 0) ctx.filter = `blur(${blur}px)`;
      ctx.translate(size / 2, size / 2);
      draw(ctx, s);
      return c;
    }),
  );
  return { canvases, size };
};
