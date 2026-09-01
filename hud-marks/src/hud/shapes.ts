import { random } from "remotion";
import { mix } from "./color";
import type { MarkOpts, Palette } from "./types";

/**
 * Every shape draws into a local box (0,0)-(w,h) on an offscreen sprite canvas
 * that the caller has already padded and translated. Shapes never read the
 * frame number: a sprite is built once and blitted with transforms.
 *
 * Stroke weight is uniform across the whole vocabulary. The crossed X's two
 * primary strokes are the single sanctioned exception.
 */
export type ShapeArgs = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** The mark's own colour, already resolved from its tone. */
  color: string;
  palette: Palette;
  stroke: number;
  opts: MarkOpts;
  /** Stable seed string for this sprite's internal detail. */
  seed: string;
};

const line = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

const ring = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
};

const RAD = Math.PI / 180;

/** An L: two perpendicular strokes meeting at a right angle. */
export const cornerBracket = ({ ctx, w, h }: ShapeArgs) => {
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.stroke();
};

/** A corner bracket whose two arms stop short of meeting — a press crop mark. */
export const cropMark = ({ ctx, w, h, opts }: ShapeArgs) => {
  const gap = opts.gap ?? Math.min(w, h) * 0.22;
  line(ctx, gap, 0, w, 0);
  line(ctx, 0, gap, 0, h);
};

/** A vertical stack of small hollow circles, sometimes doubled. */
export const dotColumn = ({ ctx, w, h, opts, seed, stroke }: ShapeArgs) => {
  const columns = opts.columns ?? 1;
  const dots = opts.dots ?? 6 + Math.floor(random(`${seed}:dots`) * 5);
  const r = Math.max(stroke * 2, Math.min(16, w / (columns * 3.2)));
  for (let c = 0; c < columns; c++) {
    const cx = columns === 1 ? w / 2 : r + (c * (w - 2 * r)) / (columns - 1);
    for (let i = 0; i < dots; i++) {
      const cy = r + (i * (h - 2 * r)) / (dots - 1);
      ring(ctx, cx, cy, r);
    }
  }
};

/** A > shape, optionally stacked into a pair. */
export const chevron = ({ ctx, w, h, opts }: ShapeArgs) => {
  const one = (y0: number, height: number) => {
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(w, y0 + height / 2);
    ctx.lineTo(0, y0 + height);
    ctx.stroke();
  };
  if (opts.pair) {
    one(0, h * 0.44);
    one(h * 0.56, h * 0.44);
  } else {
    one(0, h);
  }
};

/** Two short parallel diagonal strokes. */
export const diagonalPair = ({ ctx, w, h }: ShapeArgs) => {
  const d = Math.min(w, h) * 0.6;
  const step = w - d;
  for (let k = 0; k < 2; k++) {
    const x0 = k * step;
    line(ctx, x0, h, x0 + d, h - d);
  }
};

/**
 * A large X of two thick strokes, over a lattice of thinner diagonals with
 * small square outlines scattered through it.
 */
export const crossedX = ({ ctx, w, h, stroke, seed }: ShapeArgs) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  // Lattice behind, at the uniform stroke weight — open enough to read as
  // ruling rather than as a filled mesh.
  const step = w / 4.5;
  const spans = Math.ceil((w + h) / step);
  for (let i = -spans; i <= spans; i++) {
    line(ctx, i * step, 0, i * step + h, h);
    line(ctx, i * step, 0, i * step - h, h);
  }

  // Small square outlines scattered through the lattice.
  const squares = 7 + Math.floor(random(`${seed}:sq`) * 4);
  const side = Math.min(w, h) * 0.07;
  for (let i = 0; i < squares; i++) {
    const sx = random(`${seed}:sqx${i}`) * (w - side);
    const sy = random(`${seed}:sqy${i}`) * (h - side);
    ctx.strokeRect(sx, sy, side, side);
  }
  ctx.restore();

  // The two primary strokes — the only thick elements in the whole piece.
  ctx.save();
  ctx.lineWidth = stroke * 4.5;
  const inset = Math.min(w, h) * 0.06;
  line(ctx, inset, inset, w - inset, h - inset);
  line(ctx, w - inset, inset, inset, h - inset);
  ctx.restore();
};

/** A thin segment of a large circle, spanning 40-120 degrees. */
export const arc = ({ ctx, w, h, opts, seed }: ShapeArgs) => {
  const r = Math.min(w, h) / 2;
  const start = opts.start ?? random(`${seed}:as`) * 360;
  const sweep = opts.sweep ?? 40 + random(`${seed}:aw`) * 80;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r, start * RAD, (start + sweep) * RAD);
  ctx.stroke();
};

/**
 * A filled light rectangle divided into quadrants, with small circles at its
 * corners and scattered tiny circles inside. Interior detail is knocked out in
 * the background colour, so the panel inverts cleanly with the palette.
 */
export const squarePanel = ({
  ctx,
  w,
  h,
  palette,
  stroke,
  seed,
}: ShapeArgs) => {
  ctx.fillStyle = palette.panel;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = palette.bg;
  ctx.lineWidth = stroke;
  line(ctx, w / 2, 0, w / 2, h);
  line(ctx, 0, h / 2, w, h / 2);

  const cr = Math.min(w, h) * 0.09;
  const pad = cr * 1.6;
  for (const [cx, cy] of [
    [pad, pad],
    [w - pad, pad],
    [pad, h - pad],
    [w - pad, h - pad],
  ]) {
    ring(ctx, cx, cy, cr);
  }

  const tiny = 9 + Math.floor(random(`${seed}:tiny`) * 6);
  const tr = stroke * 1.6;
  for (let i = 0; i < tiny; i++) {
    const cx = tr * 2 + random(`${seed}:tx${i}`) * (w - tr * 4);
    const cy = tr * 2 + random(`${seed}:ty${i}`) * (h - tr * 4);
    ring(ctx, cx, cy, tr);
  }
};

/** A horizontal row of short vertical strokes at even spacing. */
export const tickRow = ({ ctx, w, h, opts, seed }: ShapeArgs) => {
  const n = opts.ticks ?? 8 + Math.floor(random(`${seed}:ticks`) * 7);
  for (let i = 0; i < n; i++) {
    const x = (i * w) / (n - 1);
    line(ctx, x, 0, x, h);
  }
};

/** A large thin circle, often placed so the frame crops it. */
export const circleOutline = ({ ctx, w, h }: ShapeArgs) => {
  ring(ctx, w / 2, h / 2, Math.min(w, h) / 2);
};

/** A single short horizontal stroke, used as punctuation. */
export const dash = ({ ctx, w, h }: ShapeArgs) => {
  line(ctx, 0, h / 2, w, h / 2);
};

/** A circle with a cross through it extending past the circle on all sides. */
export const registrationTarget = ({ ctx, w, h }: ShapeArgs) => {
  const r = Math.min(w, h) * 0.3;
  ring(ctx, w / 2, h / 2, r);
  line(ctx, 0, h / 2, w, h / 2);
  line(ctx, w / 2, 0, w / 2, h);
};

/** A row of small filled squares in greys, one of them the accent. */
export const colourBar = ({ ctx, w, h, palette, opts, seed }: ShapeArgs) => {
  const n = opts.swatches ?? 6 + Math.floor(random(`${seed}:sw`) * 3);
  const gap = h * 0.22;
  const side = (w - gap * (n - 1)) / n;
  const accentAt = opts.accentAt ?? n - 2;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle =
      i === accentAt ? palette.accent : mix(palette.ink, palette.bg, i / n);
    ctx.fillRect(i * (side + gap), 0, side, h);
  }
};
