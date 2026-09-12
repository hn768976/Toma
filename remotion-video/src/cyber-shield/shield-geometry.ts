// Local-space geometry for the shield: outline, keyhole, and the grid of
// mosaic tiles that fills it. All of it is resolution-independent point
// data — the camera in projection.ts turns it into screen geometry.

import { Point, sampleCubic } from "./projection";

/** Half-width / height envelope of the shield, in local units. */
export const SHIELD_HALF_WIDTH = 196;
export const SHIELD_TOP = -206;
export const SHIELD_BOTTOM = 236;

const CURVE_STEPS = 26;

// Right half of a heater shield: a shallow crest at top-centre, widest
// point just below the shoulders, then a long taper to a rounded tip.
const buildHalfOutline = (): Point[] => {
  const top: Point = [0, SHIELD_TOP];
  const shoulder: Point = [188, -168];
  const waist: Point = [185, 42];
  const tip: Point = [0, SHIELD_BOTTOM];

  return [
    top,
    ...sampleCubic(top, [64, -198], [142, -182], shoulder, CURVE_STEPS),
    ...sampleCubic(
      shoulder,
      [SHIELD_HALF_WIDTH, -120],
      [197, -38],
      waist,
      CURVE_STEPS,
    ),
    ...sampleCubic(waist, [172, 124], [112, 184], tip, CURVE_STEPS),
  ];
};

/** Closed shield outline, clockwise, starting at the top centre. */
export const SHIELD_OUTLINE: Point[] = (() => {
  const right = buildHalfOutline();
  // Mirror everything but the shared top and tip points.
  const left = right
    .slice(1, right.length - 1)
    .reverse()
    .map(([x, y]) => [-x, y] as Point);
  return [...right, ...left];
})();

// --- Keyhole -------------------------------------------------------------

const KEYHOLE_CENTER_Y = -34;
const KEYHOLE_RADIUS = 37;
const KEYHOLE_STEM_BOTTOM = 104;
const KEYHOLE_STEM_TOP_HALF = 15;
const KEYHOLE_STEM_BOTTOM_HALF = 28;

/**
 * Classic keyhole: a circle with a flared stem hanging off it. Built as
 * one closed polygon so it can be punched out of the shield with an
 * even-odd fill rule.
 */
export const KEYHOLE_OUTLINE: Point[] = (() => {
  const out: Point[] = [];
  // Angle (from straight down) at which the stem meets the circle. In SVG
  // space +y is down, so 90 degrees is the bottom of the circle: the arc
  // runs from the stem's left join, all the way round, to its right join.
  const joinDeg =
    (Math.asin(KEYHOLE_STEM_TOP_HALF / KEYHOLE_RADIUS) * 180) / Math.PI;
  const startDeg = 90 + joinDeg;
  const sweepDeg = 360 - 2 * joinDeg;
  const steps = 72;
  for (let i = 0; i <= steps; i++) {
    const a = ((startDeg + (sweepDeg * i) / steps) * Math.PI) / 180;
    out.push([
      Math.cos(a) * KEYHOLE_RADIUS,
      KEYHOLE_CENTER_Y + Math.sin(a) * KEYHOLE_RADIUS,
    ]);
  }
  // Down the right flare, across the base, and back up the left flare to
  // close on the arc's start point.
  out.push([KEYHOLE_STEM_BOTTOM_HALF, KEYHOLE_STEM_BOTTOM]);
  out.push([-KEYHOLE_STEM_BOTTOM_HALF, KEYHOLE_STEM_BOTTOM]);
  return out;
})();

// --- Mosaic --------------------------------------------------------------

export const MOSAIC_CELL = 12.5;
const MOSAIC_GAP = 1.3;

export type MosaicCell = {
  /** Top-left corner in local space. */
  x: number;
  y: number;
  size: number;
  /** Stable index, used to seed brightness and flicker phase. */
  index: number;
  /** 0 at the shield's top, 1 at its tip — drives the vertical gradient. */
  t: number;
};

const isInside = (poly: Point[], x: number, y: number): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * Tiles the shield's bounding box and keeps the cells whose centre falls
 * inside the outline. Cells that straddle the edge are kept and trimmed
 * at render time by the shield clip path, which is what gives the
 * reference's ragged pixel-mesh edge.
 */
export const buildMosaicCells = (): MosaicCell[] => {
  const cells: MosaicCell[] = [];
  const height = SHIELD_BOTTOM - SHIELD_TOP;
  let index = 0;
  for (let y = SHIELD_TOP; y < SHIELD_BOTTOM; y += MOSAIC_CELL) {
    for (let x = -SHIELD_HALF_WIDTH; x < SHIELD_HALF_WIDTH; x += MOSAIC_CELL) {
      const cx = x + MOSAIC_CELL / 2;
      const cy = y + MOSAIC_CELL / 2;
      // A one-cell margin keeps the mesh reaching past the outline so the
      // clip does the trimming rather than leaving a bald rim.
      if (
        !isInside(SHIELD_OUTLINE, cx, cy) &&
        !isInside(SHIELD_OUTLINE, cx, cy - MOSAIC_CELL)
      ) {
        continue;
      }
      cells.push({
        x,
        y,
        size: MOSAIC_CELL - MOSAIC_GAP,
        index: index++,
        t: (cy - SHIELD_TOP) / height,
      });
    }
  }
  return cells;
};
