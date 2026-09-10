import type { FillKind } from "../types";
import type { Rng } from "../rng";
import { css, lighten, darken, luminance, type Rgb } from "../color";

const TAU = Math.PI * 2;

export type Box = { x0: number; y0: number; x1: number; y1: number };

export type FillOptions = {
  ctx: CanvasRenderingContext2D;
  /** Region in motif-local coordinates; the canvas is already translated. */
  region: Path2D;
  rule: CanvasFillRule;
  ink: Rgb;
  paper: Rgb;
  alpha: number;
  extent: number;
  /**
   * The part of the motif that actually falls inside the frame, in local
   * coordinates. Pattern work outside it is skipped — most motifs are cropped.
   */
  box: Box;
  /** Height relative to the 2560px reference frame. */
  scale: number;
  strokePx: number;
  /** Gradient / hatch direction in radians. */
  angle: number;
  density: number;
  rng: Rng;
};

const clipToRegion = (o: FillOptions) => {
  o.ctx.beginPath();
  o.ctx.clip(o.region, o.rule);
};

/* ── SOLID ──────────────────────────────────────────────────────────────── */

const solid = (o: FillOptions) => {
  o.ctx.fillStyle = css(o.ink, o.alpha);
  o.ctx.fill(o.region, o.rule);
};

/* ── STIPPLE ────────────────────────────────────────────────────────────────
   Tiny dots whose density falls off across the shape, so the motif appears to
   fade out — printed gold leaf rather than a halftone. Candidates come from a
   jittered grid; each is kept with a probability taken from its position
   along the gradient direction.                                             */

const stipple = (o: FillOptions) => {
  const { ctx, rng } = o;
  const spacing = 6.2 * o.scale;
  const cos = Math.cos(o.angle);
  const sin = Math.sin(o.angle);
  const span = o.extent * 2;

  ctx.save();
  clipToRegion(o);
  ctx.fillStyle = css(o.ink, o.alpha);

  for (let y = o.box.y0; y < o.box.y1; y += spacing) {
    for (let x = o.box.x0; x < o.box.x1; x += spacing) {
      const px = x + rng.next() * spacing;
      const py = y + rng.next() * spacing;
      // 0 at the dense edge, 1 at the faded edge.
      const t = Math.min(
        1,
        Math.max(0, (px * cos + py * sin + o.extent) / span),
      );
      const keep = (0.14 + 0.86 * Math.pow(1 - t, 1.3)) * o.density;
      if (rng.next() > keep) continue;
      const dotR = (1.5 + rng.next() * 1.5) * o.scale;
      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
};

/* ── LINE FILL ──────────────────────────────────────────────────────────────
   Fine parallel lines at one consistent angle, evenly spaced, stopping at the
   shape's boundary.                                                         */

const lineFill = (o: FillOptions) => {
  const { ctx } = o;
  const spacing = (13 / o.density) * o.scale;
  const reach = o.extent * 1.5;

  ctx.save();
  clipToRegion(o);
  ctx.rotate(o.angle);
  ctx.strokeStyle = css(o.ink, o.alpha);
  ctx.lineWidth = 3.4 * o.scale;
  ctx.beginPath();
  for (let y = -reach; y <= reach; y += spacing) {
    ctx.moveTo(-reach, y);
    ctx.lineTo(reach, y);
  }
  ctx.stroke();
  ctx.restore();
};

/* ── DOT GRID ───────────────────────────────────────────────────────────── */

const dotGrid = (o: FillOptions) => {
  const { ctx } = o;
  const spacing = (18 / o.density) * o.scale;
  const dotR = 3.2 * o.scale;

  ctx.save();
  clipToRegion(o);
  ctx.fillStyle = css(o.ink, o.alpha);
  for (let y = o.box.y0; y <= o.box.y1; y += spacing) {
    for (let x = o.box.x0; x <= o.box.x1; x += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
};

/* ── OUTLINE ONLY ───────────────────────────────────────────────────────── */

const outline = (o: FillOptions) => {
  o.ctx.strokeStyle = css(o.ink, o.alpha);
  o.ctx.lineWidth = o.strokePx;
  o.ctx.stroke(o.region);
};

/* ── METALLIC ───────────────────────────────────────────────────────────────
   A solid fill with irregular tonal patches over it plus a few fine lighter
   streaks, as gold leaf catches the light. Patches, not a gradient.         */

const metallic = (o: FillOptions) => {
  const { ctx, rng } = o;
  solid(o);

  ctx.save();
  clipToRegion(o);

  const bright = lighten(o.ink, 0.34);
  const deep = darken(o.ink, 0.22);
  const patches = 34;
  for (let i = 0; i < patches; i += 1) {
    const px = rng.range(o.box.x0, o.box.x1);
    const py = rng.range(o.box.y0, o.box.y1);
    const pr = o.extent * rng.range(0.12, 0.42);
    const up = rng.chance(0.55);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    const tone = up ? bright : deep;
    grad.addColorStop(0, css(tone, 0.16 * o.alpha));
    grad.addColorStop(1, css(tone, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();
  }

  // Fine streaks.
  ctx.strokeStyle = css(bright, 0.2 * o.alpha);
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i += 1) {
    const px = rng.range(o.box.x0, o.box.x1);
    const py = rng.range(o.box.y0, o.box.y1);
    const len = o.extent * rng.range(0.25, 0.8);
    const a = o.angle + rng.range(-0.35, 0.35);
    ctx.lineWidth = rng.range(1.2, 2.6) * o.scale;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
};

/* ── WOVEN ──────────────────────────────────────────────────────────────────
   Two fine line sets at right angles: a textile crosshatch.                 */

const woven = (o: FillOptions) => {
  const { ctx } = o;
  const spacing = (9.5 / o.density) * o.scale;
  const reach = o.extent * 1.5;

  ctx.save();
  clipToRegion(o);
  ctx.rotate(o.angle);
  ctx.strokeStyle = css(o.ink, o.alpha);
  ctx.lineWidth = 2.4 * o.scale;
  ctx.beginPath();
  for (let y = -reach; y <= reach; y += spacing) {
    ctx.moveTo(-reach, y);
    ctx.lineTo(reach, y);
  }
  for (let x = -reach; x <= reach; x += spacing) {
    ctx.moveTo(x, -reach);
    ctx.lineTo(x, reach);
  }
  ctx.stroke();
  ctx.restore();
};

const TREATMENTS: Record<FillKind, (o: FillOptions) => void> = {
  solid,
  stipple,
  lineFill,
  dotGrid,
  outline,
  metallic,
  woven,
};

export const paintFill = (kind: FillKind, o: FillOptions): void => {
  TREATMENTS[kind](o);
};

/**
 * Line and dot treatments read as too light when the ink is very close to the
 * paper tone; nudge such inks away from the paper so pale accents stay legible.
 */
export const legibleInk = (ink: Rgb, paper: Rgb): Rgb => {
  const gap = luminance(ink) - luminance(paper);
  if (Math.abs(gap) >= 0.05) return ink;
  // Push the ink further in the direction it already leans, so the hue of a
  // pale accent survives while the value separates from the sheet.
  return gap < 0 ? darken(ink, 0.13) : lighten(ink, 0.13);
};
