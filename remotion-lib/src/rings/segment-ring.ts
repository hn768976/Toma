import { clamp } from "../random/seeded";
import { tickRing } from "../draw/shapes";

export type SegmentRingColors = {
  lit: string;
  unlit: string;
  tick: string;
  tickMajor: string;
  innerCircle: string;
};

export type SegmentRingOpts = {
  cx: number;
  cy: number;
  /** Centre-line radius of the segment band. */
  radius: number;
  /** Radial thickness of a segment. */
  thickness: number;
  segments: number;
  /** Fraction of each segment's angular slot left as a gap. */
  gapFraction: number;
  colors: SegmentRingColors;
  /** Frame, already wrapped into the loop. */
  frame: number;
  /** Frames per light-up cycle. Divide the loop length by this to choose how
   *  many complete cycles the ring runs — it must divide evenly or the ring
   *  is caught mid-fill at the cut. */
  period: number;
};

// Cycle shape, as fractions of one cycle:
//   0 .. FILL_END      segments light up progressively
//   FILL_END .. HOLD   the full ring holds
//   HOLD .. 1          everything is extinguished, then it restarts
const FILL_END = 0.84;
const HOLD_END = 0.93;
const FADE_IN_SEGMENTS = 2.2; // segments' worth of soft leading edge

/**
 * A ring of discrete rounded segments — a circular progress indicator built
 * from separate blocks rather than one continuous arc.
 *
 * Segments light progressively around the ring, hold briefly at full, then all
 * extinguish before the cycle restarts. One cycle takes `period` frames; pick
 * a period that divides the composition's loop length so the ring is never
 * caught mid-fill at the cut.
 *
 * Drawn as thick round-capped arcs rather than paths: a stroked arc with
 * `lineCap: "round"` IS a rounded segment, which is both simpler and cheaper
 * than building each block as a polar rounded rect.
 */
export const drawSegmentRing = (ctx: CanvasRenderingContext2D, o: SegmentRingOpts) => {
  const {
    cx,
    cy,
    radius,
    thickness,
    segments,
    gapFraction,
    colors,
    frame,
    period,
  } = o;

  const phase = (frame % period) / period;
  // How many segments are lit, as a real number so the leading edge can ramp.
  const litFront =
    phase < FILL_END
      ? (phase / FILL_END) * segments
      : phase < HOLD_END
        ? segments
        : 0;

  const slot = (Math.PI * 2) / segments;
  const gap = slot * gapFraction;
  const arc = slot - gap;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = thickness;

  for (let i = 0; i < segments; i++) {
    // Start at 12 o'clock and fill clockwise.
    const a0 = -Math.PI / 2 + slot * i + gap / 2;
    const a1 = a0 + arc;
    const level = clamp((litFront - i) / FADE_IN_SEGMENTS, 0, 1);

    ctx.beginPath();
    ctx.strokeStyle = colors.unlit;
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.arc(cx, cy, radius, a0, a1);
    ctx.stroke();

    if (level > 0.01) {
      ctx.beginPath();
      ctx.globalAlpha = level;
      ctx.strokeStyle = colors.lit;
      ctx.shadowColor = colors.lit;
      // The newest segment burns brightest — it is what makes the direction
      // of travel legible.
      ctx.shadowBlur = thickness * (0.5 + 1.5 * level);
      ctx.arc(cx, cy, radius, a0, a1);
      ctx.stroke();
    }
  }
  ctx.restore();
};

/** The static furniture around the segments: an outer tick ring and an inner
 *  circle outline. Rasterise once. */
export const drawSegmentRingChrome = (
  ctx: CanvasRenderingContext2D,
  o: Pick<SegmentRingOpts, "cx" | "cy" | "radius" | "thickness" | "colors">,
) => {
  const { cx, cy, radius, thickness, colors } = o;

  tickRing(ctx, {
    cx,
    cy,
    radius: radius + thickness * 0.75,
    count: 180,
    length: thickness * 0.3,
    width: 1.5,
    color: colors.tick,
    majorEvery: 15,
    majorLength: thickness * 0.6,
    majorColor: colors.tickMajor,
    majorWidth: 2.5,
  });

  ctx.strokeStyle = colors.innerCircle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - thickness * 0.95, 0, Math.PI * 2);
  ctx.stroke();
};
