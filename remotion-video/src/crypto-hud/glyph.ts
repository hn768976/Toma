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
const BITCOIN: GlyphGeometry = {
  minX: -0.62,
  maxX: 0.71,
  minY: -1.3,
  maxY: 1.3,
  draw: (ctx, unit) => {
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.26 * unit;

    // Spine of the B.
    rect(ctx, unit, -0.62, -1.0, -0.34, 1.0);

    // Upper bowl.
    ctx.beginPath();
    ctx.moveTo(-0.34 * unit, -0.87 * unit);
    ctx.lineTo(0.1 * unit, -0.87 * unit);
    ctx.bezierCurveTo(
      0.54 * unit, -0.87 * unit,
      0.54 * unit, -0.13 * unit,
      0.1 * unit, -0.13 * unit,
    );
    ctx.lineTo(-0.34 * unit, -0.13 * unit);
    ctx.stroke();

    // Lower bowl, wider than the upper one.
    ctx.beginPath();
    ctx.moveTo(-0.34 * unit, 0.13 * unit);
    ctx.lineTo(0.22 * unit, 0.13 * unit);
    ctx.bezierCurveTo(
      0.7 * unit, 0.13 * unit,
      0.7 * unit, 0.87 * unit,
      0.22 * unit, 0.87 * unit,
    );
    ctx.lineTo(-0.34 * unit, 0.87 * unit);
    ctx.stroke();

    // The two vertical strokes. They only show above and below the
    // letterform; inside it they merge with the spine and the bowl bars, which
    // is what keeps the counters open.
    for (const x of [-0.545, -0.215]) {
      rect(ctx, unit, x, -1.3, x + 0.17, -0.88);
      rect(ctx, unit, x, 0.88, x + 0.17, 1.3);
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
