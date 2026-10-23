import { GLYPH, MUSIC_FONT } from "./font";

// Procedural music engraving on Canvas 2D. All sizes are expressed in staff
// spaces (`s`), the distance between two adjacent staff lines.
type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export const HEAD_RX = 0.62;

export const noteHead = (
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  filled: boolean,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.38);
  ctx.beginPath();
  ctx.ellipse(0, 0, HEAD_RX * s, 0.43 * s, 0, 0, TAU);
  if (!filled) {
    ctx.ellipse(0, 0, 0.5 * s, 0.2 * s, -0.3, 0, TAU, true);
  }
  ctx.fill("evenodd");
  ctx.restore();
};

export const stem = (ctx: Ctx, x: number, y1: number, y2: number, s: number) => {
  const w = 0.12 * s;
  ctx.fillRect(x - w / 2, Math.min(y1, y2), w, Math.abs(y2 - y1));
};

// Stem x position for a head centred at x.
export const stemX = (x: number, s: number, up: boolean) =>
  up ? x + (HEAD_RX - 0.06) * s : x - (HEAD_RX - 0.06) * s;

export const flags = (
  ctx: Ctx,
  x: number,
  tipY: number,
  s: number,
  up: boolean,
  count: number,
) => {
  const d = up ? 1 : -1;
  for (let i = 0; i < count; i++) {
    const y = tipY + d * i * 0.85 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + 0.15 * s, y + d * 1.0 * s,
      x + 1.35 * s, y + d * 1.35 * s,
      x + 0.85 * s, y + d * 2.9 * s,
    );
    ctx.bezierCurveTo(
      x + 1.05 * s, y + d * 1.75 * s,
      x + 0.35 * s, y + d * 1.4 * s,
      x, y + d * 0.95 * s,
    );
    ctx.closePath();
    ctx.fill();
  }
};

export const beam = (
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  s: number,
  thickness = 0.48,
) => {
  const t = thickness * s;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2, y2 + t);
  ctx.lineTo(x1, y1 + t);
  ctx.closePath();
  ctx.fill();
};

// Crescent-shaped arc used for slurs and ties.
export const slur = (
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  s: number,
  above: boolean,
) => {
  const d = above ? -1 : 1;
  const h = Math.min(2.2, 0.6 + Math.abs(x2 - x1) / s / 12) * s;
  const mx1 = x1 + (x2 - x1) * 0.25;
  const mx2 = x1 + (x2 - x1) * 0.75;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(mx1, y1 + d * h, mx2, y2 + d * h, x2, y2);
  ctx.bezierCurveTo(
    mx2, y2 + d * (h - 0.22 * s),
    mx1, y1 + d * (h - 0.22 * s),
    x1, y1,
  );
  ctx.fill();
};

export const fermata = (ctx: Ctx, x: number, y: number, s: number) => {
  const r = 1.0 * s;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r, 0, Math.PI, TAU);
  ctx.ellipse(x, y + 0.05 * s, r * 0.88, r * 0.72, 0, TAU, Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - 0.15 * s, 0.2 * s, 0, TAU);
  ctx.fill();
};

export const dot = (ctx: Ctx, x: number, y: number, s: number) => {
  ctx.beginPath();
  ctx.arc(x, y, 0.18 * s, 0, TAU);
  ctx.fill();
};

// Font glyphs: Noto Music is drawn with em = 4 staff spaces and its baseline on
// the bottom staff line.
export const fontGlyph = (
  ctx: Ctx,
  glyph: string,
  x: number,
  baselineY: number,
  s: number,
) => {
  ctx.font = `${4 * s}px ${MUSIC_FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(glyph, x, baselineY);
};

export const trebleClef = (ctx: Ctx, x: number, bottomLineY: number, s: number) =>
  fontGlyph(ctx, GLYPH.trebleClef, x, bottomLineY, s);

export const bassClef = (ctx: Ctx, x: number, bottomLineY: number, s: number) =>
  fontGlyph(ctx, GLYPH.bassClef, x, bottomLineY, s);

// Accidental centred vertically on a pitch position y.
export const flat = (ctx: Ctx, x: number, y: number, s: number) =>
  fontGlyph(ctx, GLYPH.flat, x, y + 0.5 * s, s);

export const sharp = (ctx: Ctx, x: number, y: number, s: number) =>
  fontGlyph(ctx, GLYPH.sharp, x, y + 0.5 * s, s);

export const staffLines = (
  ctx: Ctx,
  x1: number,
  x2: number,
  topY: number,
  s: number,
  lineWidth = 0.09,
) => {
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x1, topY + i * s - (lineWidth * s) / 2, x2 - x1, lineWidth * s);
  }
};

export const brace = (ctx: Ctx, x: number, y1: number, y2: number, s: number) => {
  const h = y2 - y1;
  const m = (y1 + y2) / 2;
  const w = 1.1 * s;
  ctx.beginPath();
  ctx.moveTo(x, m);
  ctx.bezierCurveTo(x + w * 0.9, m - h * 0.05, x - w * 0.4, y1 + h * 0.2, x + w, y1);
  ctx.bezierCurveTo(x, y1 + h * 0.2, x + w * 1.5, m - h * 0.06, x, m);
  ctx.bezierCurveTo(x + w * 1.5, m + h * 0.06, x, y2 - h * 0.2, x + w, y2);
  ctx.bezierCurveTo(x - w * 0.4, y2 - h * 0.2, x + w * 0.9, m + h * 0.05, x, m);
  ctx.fill();
};
