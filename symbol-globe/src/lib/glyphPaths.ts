/**
 * Hand-proportioned punctuation and symbol geometry.
 *
 * Each glyph is described once, as centrelines plus circles, in an abstract
 * design space where y grows downward. That single description renders two
 * ways:
 *
 *   - `outlineGlyph()`  the centrelines are expanded into variable-width
 *                       silhouettes, so a *stroked* result reads as a hollow
 *                       neon tube with the background visible through it.
 *   - `monoGlyph()`     the centrelines are returned as-is, to be stroked at a
 *                       uniform width — which is what small marks want.
 *
 * These are drawn shapes rather than font glyphs so that proportions (the gap
 * under a question mark's stem, the taper of an exclamation's bar) can be
 * tuned directly.
 */
import {
  boundsOf,
  chain,
  ribbon,
  sampleArc,
  sampleCubic,
  sampleLine,
  unionBounds,
  type Bounds,
  type CapStyle,
  type Pt,
  type WidthStop,
} from "./ribbon";

export type GlyphKind =
  | "question"
  | "exclamation"
  | "plus"
  | "percent"
  | "triangle"
  | "circledCross";

type StrokeSpec = {
  points: Pt[];
  widthStops: WidthStop[];
  capStart?: CapStyle;
  capEnd?: CapStyle;
  interpolation?: "linear" | "smooth";
  /** Closed outlines (the warning triangle) are stroked, never ribboned. */
  closed?: boolean;
};

type GlyphSpec = {
  strokes: StrokeSpec[];
  /** Solid dots: filled when monoline, contour-stroked when outlined. */
  discs: { cx: number; cy: number; r: number }[];
  /** Always drawn as a ring, at both scales (the percent sign's bowls). */
  rings: { cx: number; cy: number; r: number }[];
  /**
   * Rendered size relative to a question mark of the same nominal size, so a
   * "+" and a "?" set at 60px read as the same visual weight rather than the
   * same bounding-box height.
   */
  fieldScale: number;
};

/** Uniform width profile, for marks that do not taper. */
const flat = (w: number): WidthStop[] => [
  { t: 0, w },
  { t: 1, w },
];

const QUESTION: GlyphSpec = (() => {
  // Anatomy, in the order the spine is walked:
  //
  //   1. a bowl, swept as a circular arc from a thin terminal at the lower
  //      left, up round the top and down the right side to about 4:30;
  //   2. a short cubic that turns the stroke inward and brings it to the
  //      centreline while still well above the baseline;
  //   3. a straight vertical stem.
  //
  // Step 3 is what makes it a question mark. Carrying the curve all the way
  // down instead — one long diagonal from the bowl to the foot — produces a
  // shepherd's crook or a figure 2, however well drawn the bowl is.
  const bowlCentre = { x: 0, y: -300 };
  const bowlRadius = 168;
  const bowl = sampleArc(bowlCentre.x, bowlCentre.y, bowlRadius, 150, 400, 84);

  const bowlEnd = bowl[bowl.length - 1];
  // Tangent of the arc where it leaves the bowl, at 40 degrees: down and to
  // the left. The first control point continues along it so the join is smooth.
  const leaveAngle = (40 * Math.PI) / 180;
  const leave = { x: -Math.sin(leaveAngle), y: Math.cos(leaveAngle) };
  const stemTop = { x: 0, y: 15 };
  // The turn is given a generous vertical run. Tightening it further would
  // push the inner offset's radius of curvature below half the stroke width,
  // at which point the outline folds through itself and leaves a notch.
  const turn = sampleCubic(
    bowlEnd,
    { x: bowlEnd.x + leave.x * 120, y: bowlEnd.y + leave.y * 120 },
    // Directly above the stem top, so the stroke arrives travelling straight
    // down and the stem continues it without a kink.
    { x: stemTop.x, y: stemTop.y - 75 },
    stemTop,
    36,
  );

  const stem = sampleLine(stemTop, { x: 0, y: 200 }, 16);

  return {
    strokes: [
      {
        points: chain(bowl, turn, stem),
        // Letterform contrast: heavy on the bowl's left and right shoulders
        // where the stroke runs vertically, lighter across the top where it
        // runs horizontally, thinning to a fine terminal and tapering again
        // into the stem's foot.
        widthStops: [
          { t: 0, w: 66 },
          { t: 0.12, w: 86 },
          { t: 0.3, w: 68 },
          { t: 0.527, w: 86 },
          { t: 0.66, w: 74 },
          { t: 0.84, w: 58 },
          { t: 1, w: 50 },
        ],
        // Cut square, the way a sans-serif question mark's bowl ends. A round
        // cap on a stroke this much lighter than the bowl behind it flares into
        // a beak as the width ramps up.
        capStart: "flat",
        capEnd: "round",
        interpolation: "smooth",
      },
    ],
    // Set well clear of the stem: a question mark whose stem touches its dot
    // reads as a malformed letterform.
    discs: [{ cx: 0, cy: 400, r: 62 }],
    rings: [],
    fieldScale: 1,
  };
})();

const EXCLAMATION: GlyphSpec = {
  strokes: [
    {
      // A bar that is markedly wider at the top than the bottom. Without that
      // taper it reads as a rectangle with a dot, not as punctuation.
      points: [
        { x: 0, y: -460 },
        { x: 0, y: 140 },
      ],
      widthStops: [
        { t: 0, w: 100 },
        { t: 1, w: 46 },
      ],
      capStart: "flat",
      capEnd: "flat",
    },
  ],
  discs: [{ cx: 0, cy: 350, r: 62 }],
  rings: [],
  fieldScale: 0.95,
};

const PLUS: GlyphSpec = {
  strokes: [
    {
      points: [
        { x: -100, y: 0 },
        { x: 100, y: 0 },
      ],
      widthStops: flat(30),
    },
    {
      points: [
        { x: 0, y: -100 },
        { x: 0, y: 100 },
      ],
      widthStops: flat(30),
    },
  ],
  discs: [],
  rings: [],
  fieldScale: 0.5,
};

const PERCENT: GlyphSpec = {
  strokes: [
    {
      points: [
        { x: 112, y: -150 },
        { x: -112, y: 150 },
      ],
      widthStops: flat(28),
    },
  ],
  discs: [],
  rings: [
    { cx: -96, cy: -96, r: 56 },
    { cx: 96, cy: 96, r: 56 },
  ],
  fieldScale: 0.62,
};

const TRIANGLE: GlyphSpec = {
  strokes: [
    {
      points: [
        { x: 0, y: -140 },
        { x: 148, y: 122 },
        { x: -148, y: 122 },
      ],
      widthStops: flat(26),
      closed: true,
    },
    {
      points: [
        { x: 0, y: -42 },
        { x: 0, y: 42 },
      ],
      widthStops: flat(24),
    },
  ],
  discs: [{ cx: 0, cy: 82, r: 14 }],
  rings: [],
  fieldScale: 0.62,
};

const CIRCLED_CROSS: GlyphSpec = {
  strokes: [
    {
      points: [
        { x: -60, y: -60 },
        { x: 60, y: 60 },
      ],
      widthStops: flat(26),
    },
    {
      points: [
        { x: 60, y: -60 },
        { x: -60, y: 60 },
      ],
      widthStops: flat(26),
    },
  ],
  discs: [],
  rings: [{ cx: 0, cy: 0, r: 128 }],
  fieldScale: 0.55,
};

const SPECS: Record<GlyphKind, GlyphSpec> = {
  question: QUESTION,
  exclamation: EXCLAMATION,
  plus: PLUS,
  percent: PERCENT,
  triangle: TRIANGLE,
  circledCross: CIRCLED_CROSS,
};

export const glyphFieldScale = (kind: GlyphKind): number =>
  SPECS[kind].fieldScale;

export type BuiltGlyph = {
  /** Sub-paths to draw, in order. */
  paths: Path2D[];
  bounds: Bounds;
  /**
   * Line width, in design units, that a monoline rendering should use. Zero
   * for outline renderings, where width is the caller's stylistic choice.
   */
  monoWidth: number;
};

const circlePath = (cx: number, cy: number, r: number): Path2D => {
  const path = new Path2D();
  path.arc(cx, cy, r, 0, Math.PI * 2);
  return path;
};

const circleBounds = (cx: number, cy: number, r: number): Bounds => ({
  minX: cx - r,
  minY: cy - r,
  maxX: cx + r,
  maxY: cy + r,
});

/**
 * The glyph as a hollow silhouette: stroke the result and the background shows
 * through the letterform, which is what the four-pass neon build wants.
 */
export const outlineGlyph = (kind: GlyphKind): BuiltGlyph => {
  const spec = SPECS[kind];
  const paths: Path2D[] = [];
  const allBounds: Bounds[] = [];

  for (const stroke of spec.strokes) {
    if (stroke.closed) {
      // A closed run has no ends to cap; ribboning it would tear at the seam,
      // so it stays a plain polygon and the caller's stroke gives it weight.
      const path = new Path2D();
      stroke.points.forEach((p, i) =>
        i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y),
      );
      path.closePath();
      paths.push(path);
      allBounds.push(boundsOf(stroke.points));
      continue;
    }
    const built = ribbon(stroke.points, {
      widthStops: stroke.widthStops,
      capStart: stroke.capStart,
      capEnd: stroke.capEnd,
      interpolation: stroke.interpolation,
    });
    paths.push(built.path);
    allBounds.push(built.bounds);
  }

  for (const d of [...spec.discs, ...spec.rings]) {
    paths.push(circlePath(d.cx, d.cy, d.r));
    allBounds.push(circleBounds(d.cx, d.cy, d.r));
  }

  return { paths, bounds: unionBounds(allBounds), monoWidth: 0 };
};

/**
 * The glyph as centrelines, for stroking at a uniform width. Discs come back
 * as a separate list because they want filling rather than stroking.
 */
export const monoGlyph = (
  kind: GlyphKind,
): BuiltGlyph & { discPaths: Path2D[] } => {
  const spec = SPECS[kind];
  const paths: Path2D[] = [];
  const discPaths: Path2D[] = [];
  const allBounds: Bounds[] = [];

  for (const stroke of spec.strokes) {
    const path = new Path2D();
    stroke.points.forEach((p, i) =>
      i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y),
    );
    if (stroke.closed) path.closePath();
    paths.push(path);
    allBounds.push(boundsOf(stroke.points));
  }

  for (const ring of spec.rings) {
    paths.push(circlePath(ring.cx, ring.cy, ring.r));
    allBounds.push(circleBounds(ring.cx, ring.cy, ring.r));
  }

  for (const disc of spec.discs) {
    discPaths.push(circlePath(disc.cx, disc.cy, disc.r));
    allBounds.push(circleBounds(disc.cx, disc.cy, disc.r));
  }

  const raw = unionBounds(allBounds);
  // Keyed to the glyph's own height so every mark carries the same relative
  // weight once scaled to its rendered size.
  const monoWidth = (raw.maxY - raw.minY) * 0.062;
  // Centrelines sit half a stroke inside the drawn extent; grow the bounds so
  // a caller scaling to a target height gets the height it asked for.
  const pad = monoWidth / 2;
  const bounds = {
    minX: raw.minX - pad,
    minY: raw.minY - pad,
    maxX: raw.maxX + pad,
    maxY: raw.maxY + pad,
  };
  return { paths, discPaths, bounds, monoWidth };
};
