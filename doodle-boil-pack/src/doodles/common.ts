import { bboxOf, BBox, handDrawn, pressedEnds, Pt, samplePath, polyPath, smoothPath, Stroke, variantStroke } from "../lib/geom";
import type { Layer } from "../lib/layer";
import { rngFor } from "../lib/random";
import type { Doodle } from "../lib/scene";

export const SPACING = 6; // centre-line sample spacing, composition units

/** A stroke from hand-placed control points: smooth (Catmull-Rom) or straight-edged. */
export const strokeFrom = (
  ctrl: Pt[],
  size: number,
  opts: { straight?: boolean; pressure?: (n: number) => number[]; thinning?: number; flat?: boolean } = {},
): Stroke => {
  const pts = samplePath(opts.straight ? polyPath(ctrl) : smoothPath(ctrl), SPACING);
  return {
    pts,
    size,
    thinning: opts.thinning,
    flat: opts.flat,
    pressure: (opts.pressure ?? ((n) => pressedEnds(n)))(pts.length),
  };
};

/**
 * Open arrow head drawn as one stroke: barb, tip, barb.
 * `dir` is the travel direction at the tip (radians).
 */
export const chevron = (tip: Pt, dir: number, len: number, spread = 0.55, skew = 0): Pt[] => {
  const back = dir + Math.PI;
  const a = back + spread + skew;
  const b = back - spread + skew;
  return [
    [tip[0] + Math.cos(a) * len, tip[1] + Math.sin(a) * len],
    tip,
    [tip[0] + Math.cos(b) * len * 0.92, tip[1] + Math.sin(b) * len * 0.92],
  ];
};

/** Direction of travel at the end of a sampled line. */
export const endDir = (pts: Pt[], back = 6): number => {
  const a = pts[Math.max(0, pts.length - 1 - back)];
  const b = pts[pts.length - 1];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
};

// Base drawings get their hand (tremor + pressure) once; the boil then redraws around that.
const handCache = new WeakMap<Stroke, Stroke>();
const withHand = (s: Stroke, amp: number, seed: () => number) => {
  let h = handCache.get(s);
  if (!h) {
    // Tremor scales with the line: thin fill strokes shake less than a fat outline.
    h = handDrawn(s, Math.min(amp * 1.1, s.size * 0.12), seed);
    handCache.set(s, h);
  }
  return h;
};

export const variantsOf = (id: string, idx: number, v: number, base: Stroke[], amp: number): Stroke[] =>
  base.map((s, j) => variantStroke(withHand(s, amp, rngFor(id, idx, j, "hand")), amp, rngFor(id, idx, j, v)));

export const unionBBox = (strokes: Stroke[], pad: number): BBox =>
  bboxOf(
    strokes.flatMap((s) => s.pts),
    pad,
  );

/** One standalone doodle (clips 3-6): base strokes, a boil amplitude and an ink. */
export const singleDoodle = (
  id: string,
  base: Stroke[],
  amp: number,
  ink: (layer: Layer, strokes: Stroke[], v: number) => void,
  pad = 0,
): Doodle => {
  const maxSize = Math.max(...base.map((s) => s.size));
  const bbox = unionBBox(base, maxSize + amp * 2 + 8 + pad);
  return {
    bbox,
    center: [bbox.x + bbox.w / 2, bbox.y + bbox.h / 2],
    driftPhase: 0,
    driftCycles: [2, 1],
    render: (layer, v) => ink(layer, variantsOf(id, 0, v, base, amp), v),
  };
};
