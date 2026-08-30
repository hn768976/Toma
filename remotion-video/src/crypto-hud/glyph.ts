import type { SymbolType } from "./variants";

/**
 * Both marks are described as paths in a unit space rather than as font
 * glyphs, so stroke weight and proportions stay under our control. `unit` is
 * the pixel size of one unit; the caller has already translated the origin to
 * the glyph's centre.
 */
export type GlyphGeometry = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Paints the silhouette using the context's current fill and stroke style. */
  draw: (ctx: CanvasRenderingContext2D, unit: number) => void;
};

const rect = (
  ctx: CanvasRenderingContext2D,
  unit: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => {
  ctx.fillRect(x0 * unit, y0 * unit, (x1 - x0) * unit, (y1 - y0) * unit);
};

/**
 * The Bitcoin mark: a B whose bowls are drawn as thick strokes onto a filled
 * spine, with two vertical strokes running past the letterform top and bottom.
 */
/**
 * The Bitcoin mark.
 *
 * Built as a filled silhouette with two real counters rather than as
 * constant-width strokes: a B's middle bar is thinner than its bowls and its
 * lower bowl is wider than its upper one, and neither is expressible with a
 * single stroke weight. The cap height spans y -1..1 and the two vertical
 * strokes run out to +/-1.34.
 *
 * Both x-extrema of the right-hand outline -- each bowl's apex and the waist
 * between them -- are given vertical tangents, which is what keeps the notch
 * from reading as a dent.
 */
const BITCOIN: GlyphGeometry = {
  minX: -0.72,
  maxX: 0.7,
  minY: -1.38,
  maxY: 1.38,
  draw: (ctx, unit) => {
    const u = (n: number) => n * unit;

    ctx.beginPath();

    // Outer silhouette, clockwise from the top of the stem. Cap height spans
    // y -1..1 and the letter is 1.42 wide, a 0.71 width-to-cap ratio.
    ctx.moveTo(u(-0.72), u(-1.0));
    ctx.lineTo(u(0.12), u(-1.0));
    // Shoulder out to the upper bowl's apex.
    ctx.bezierCurveTo(u(0.3299), u(-1.0), u(0.5), u(-0.7761), u(0.5), u(-0.5));
    // A shallow inward bend to the waist. Both bowl apexes and the waist are
    // x-extrema, so all three get vertical tangents; keeping the two apexes
    // close in width is what stops the junction reading as a beak.
    ctx.bezierCurveTo(u(0.5), u(-0.26), u(0.4), u(-0.24), u(0.4), u(0.0));
    // Out again to the lower bowl, wider than the upper as a B's should be.
    ctx.bezierCurveTo(u(0.4), u(0.24), u(0.7), u(0.26), u(0.7), u(0.5));
    ctx.bezierCurveTo(u(0.7), u(0.7761), u(0.4582), u(1.0), u(0.16), u(1.0));
    ctx.lineTo(u(-0.72), u(1.0));
    ctx.closePath();

    // Upper counter. Stem 0.29, top stroke 0.27, middle bar 0.26, walls 0.29-0.30.
    ctx.moveTo(u(-0.43), u(-0.73));
    ctx.lineTo(u(-0.04), u(-0.73));
    ctx.bezierCurveTo(u(0.0981), u(-0.73), u(0.21), u(-0.5957), u(0.21), u(-0.43));
    ctx.bezierCurveTo(u(0.21), u(-0.2643), u(0.0981), u(-0.13), u(-0.04), u(-0.13));
    ctx.lineTo(u(-0.43), u(-0.13));
    ctx.closePath();

    // Lower counter: deeper and rounder, matching the wider bowl.
    ctx.moveTo(u(-0.43), u(0.13));
    ctx.lineTo(u(0.04), u(0.13));
    ctx.bezierCurveTo(u(0.2388), u(0.13), u(0.4), u(0.2621), u(0.4), u(0.425));
    ctx.bezierCurveTo(u(0.4), u(0.5879), u(0.2388), u(0.72), u(0.04), u(0.72));
    ctx.lineTo(u(-0.43), u(0.72));
    ctx.closePath();

    ctx.fill("evenodd");

    // The two vertical strokes, filled separately so that where they overlap
    // the letterform they union with it instead of cancelling under evenodd.
    // Inside the letter they merge with the stem and the bowl bars, which is
    // what keeps the counters open.
    for (const x of [-0.72, -0.26]) {
      rect(ctx, unit, x, -1.38, x + 0.23, -0.95);
      rect(ctx, unit, x, 0.95, x + 0.23, 1.38);
    }
  },
};

/**
 * An invented token mark: a flat-top hexagon crossed by a vertical bar and two
 * shorter horizontal strokes. Everything is symmetric about x = 0 so the
 * mirrored variant stays forgiving.
 */
const GENERIC: GlyphGeometry = {
  minX: -1.075,
  maxX: 1.075,
  minY: -1.1,
  maxY: 1.1,
  draw: (ctx, unit) => {
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.15 * unit;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const x = Math.cos(a) * unit;
      const y = Math.sin(a) * unit;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();

    // Vertical bar, running slightly past the flat top and bottom edges.
    rect(ctx, unit, -0.085, -1.1, 0.085, 1.1);

    // Two shorter horizontal strikes.
    rect(ctx, unit, -0.4, -0.4, 0.4, -0.28);
    rect(ctx, unit, -0.4, 0.22, 0.4, 0.34);
  },
};

export const glyphGeometry = (symbolType: SymbolType): GlyphGeometry =>
  symbolType === "bitcoin" ? BITCOIN : GENERIC;
