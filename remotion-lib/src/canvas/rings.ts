/**
 * HUD ring builders: a broken arc ring and a fine radial tick ring.
 *
 * Both are pure geometry — they take a centre, a radius and a colour, and set
 * no colour of their own beyond the one passed in, so one builder serves any
 * palette. Neither reads a frame number: rotate a ring by baking it once and
 * blitting it under a rotated transform, which keeps the segment pattern
 * rigid instead of re-randomising per frame.
 *
 *   const segments = brokenArcRing("hub/outer", 10);
 *   strokeArcRing(ctx, segments, {x: cx, y: cy}, r, 14, "#4FC4F5");
 *
 * Both accept a seed string, so a given ring is identical on every render and
 * across every worker.
 */
import { randRange } from "../random/seeded";
import { withAlpha } from "../color/hex";
import type { Vec2 } from "../geometry/polyline";

export type ArcSegment = { from: number; to: number };

/**
 * A broken ring of `count` arc segments with unequal lengths AND unequal
 * gaps, normalised to close the circle exactly.
 *
 * Equal segments read as a dial rather than as instrumentation, so the spans
 * and gaps are drawn from deliberately wide ranges. Tune `spanRange` and
 * `gapRange` to shift the balance between line and void.
 */
export const brokenArcRing = (
  seed: string,
  count: number,
  spanRange: readonly [number, number] = [0.45, 2.3],
  gapRange: readonly [number, number] = [0.18, 1.05],
): ArcSegment[] => {
  const spans = Array.from({ length: count }, (_, i) =>
    randRange(`${seed}/span/${i}`, spanRange[0], spanRange[1]),
  );
  const gaps = Array.from({ length: count }, (_, i) =>
    randRange(`${seed}/gap/${i}`, gapRange[0], gapRange[1]),
  );
  const total = [...spans, ...gaps].reduce((a, b) => a + b, 0);
  const unit = (Math.PI * 2) / total;

  const segments: ArcSegment[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    const from = at;
    at += spans[i] * unit;
    segments.push({ from, to: at });
    at += gaps[i] * unit;
  }
  return segments;
};

/** Strokes a ring of arc segments around `centre`. */
export const strokeArcRing = (
  ctx: CanvasRenderingContext2D,
  segments: readonly ArcSegment[],
  centre: Vec2,
  radius: number,
  lineWidth: number,
  color: string,
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "butt";
  for (const segment of segments) {
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius, segment.from, segment.to);
    ctx.stroke();
  }
};

export type TickStyle = {
  innerRadius: number;
  outerRadius: number;
  lineWidth: number;
  alpha: number;
};

export type TickRingOptions = {
  count: number;
  color: string;
  /** Style for ordinary ticks. */
  minor: TickStyle;
  /**
   * Every Nth tick is drawn in `major` instead, giving the ring a readable
   * beat. 0 (the default) makes every tick minor.
   */
  majorEvery?: number;
  /** Style for major ticks. Defaults to `minor`. */
  major?: TickStyle;
};

/**
 * A ring of fine radial ticks around `centre`.
 *
 * Majors may differ from minors in length at BOTH ends, in weight and in
 * alpha, which is what separates instrumentation from a measuring dial.
 *
 * `count` ticks have a rotational symmetry period of 2*PI/count, so the ring
 * can be looped seamlessly by rotating it a whole number of tick steps rather
 * than a whole turn — useful for a slow counter-rotation against another ring.
 */
export const strokeTickRing = (
  ctx: CanvasRenderingContext2D,
  centre: Vec2,
  { count, color, minor, majorEvery = 0, major }: TickRingOptions,
): void => {
  const majorStyle = major ?? minor;
  ctx.save();
  ctx.lineCap = "butt";
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const style = majorEvery > 0 && i % majorEvery === 0 ? majorStyle : minor;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    ctx.strokeStyle = withAlpha(color, style.alpha);
    ctx.lineWidth = style.lineWidth;
    ctx.beginPath();
    ctx.moveTo(
      centre.x + cos * style.innerRadius,
      centre.y + sin * style.innerRadius,
    );
    ctx.lineTo(
      centre.x + cos * style.outerRadius,
      centre.y + sin * style.outerRadius,
    );
    ctx.stroke();
  }
  ctx.restore();
};
