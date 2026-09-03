/**
 * Seven-segment numerals built from geometry rather than from a font.
 *
 * Each digit is seven bars with 45-degree mitred ends, laid out in the
 * usual a-g arrangement. The UNLIT segments are drawn too, in the dim
 * colour: that faint ghosting behind the lit ones is the single detail
 * that makes the display read as a real digital readout rather than as
 * type styled to look like one.
 */

export type Point = { x: number; y: number };
/** A segment as a closed hexagonal polygon in digit-local coordinates. */
export type SegmentPolygon = Point[];

export type SegmentMetrics = {
  /** Digit cell size. */
  width: number;
  height: number;
  /** Bar thickness. */
  thickness: number;
  /** Gap left between the ends of two meeting segments. */
  gap: number;
};

/** A horizontal bar centred on `cy`, tips at `xL` and `xR`. */
const horizontal = (
  cy: number,
  xL: number,
  xR: number,
  t: number,
): SegmentPolygon => {
  const h = t / 2;
  return [
    { x: xL + h, y: cy - h },
    { x: xR - h, y: cy - h },
    { x: xR, y: cy },
    { x: xR - h, y: cy + h },
    { x: xL + h, y: cy + h },
    { x: xL, y: cy },
  ];
};

/** A vertical bar centred on `cx`, tips at `yT` and `yB`. */
const vertical = (
  cx: number,
  yT: number,
  yB: number,
  t: number,
): SegmentPolygon => {
  const h = t / 2;
  return [
    { x: cx - h, y: yT + h },
    { x: cx, y: yT },
    { x: cx + h, y: yT + h },
    { x: cx + h, y: yB - h },
    { x: cx, y: yB },
    { x: cx - h, y: yB - h },
  ];
};

/**
 * The seven polygons in canonical order: a (top), b (top-right),
 * c (bottom-right), d (bottom), e (bottom-left), f (top-left),
 * g (middle).
 */
export const buildSegments = (m: SegmentMetrics): SegmentPolygon[] => {
  const { width: w, height: h, thickness: t, gap } = m;
  const half = t / 2;
  const xL = half + gap;
  const xR = w - half - gap;
  const leftCx = half;
  const rightCx = w - half;
  const midY = h / 2;

  return [
    horizontal(half, xL, xR, t), // a
    vertical(rightCx, half + gap, midY - gap, t), // b
    vertical(rightCx, midY + gap, h - half - gap, t), // c
    horizontal(h - half, xL, xR, t), // d
    vertical(leftCx, midY + gap, h - half - gap, t), // e
    vertical(leftCx, half + gap, midY - gap, t), // f
    horizontal(midY, xL, xR, t), // g
  ];
};

/** Which of a-g are lit, per numeral 0-9. */
export const DIGIT_SEGMENTS: readonly boolean[][] = [
  [true, true, true, true, true, true, false], // 0
  [false, true, true, false, false, false, false], // 1
  [true, true, false, true, true, false, true], // 2
  [true, true, true, true, false, false, true], // 3
  [false, true, true, false, false, true, true], // 4
  [true, false, true, true, false, true, true], // 5
  [true, false, true, true, true, true, true], // 6
  [true, true, true, false, false, false, false], // 7
  [true, true, true, true, true, true, true], // 8
  [true, true, true, true, false, true, true], // 9
];
