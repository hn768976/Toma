// The single affine that tilts the board plane into the frame, plus the
// board-space extent and lattice layout derived from it.
//
// Deliberately NOT a projection: parallel lines stay parallel. At this blur
// level real perspective is invisible, and an affine keeps the LED lattice a
// rigid part of the panel — the dots tilt with the board rather than sitting
// in screen space on top of it.
//
// An affine cannot scale unevenly across the plane, so the "nearer at the
// lower-left" read is carried by the depth of field instead: the upper-left
// resolves to individual emitters while the lower-right dissolves into
// continuous glowing strokes.

import {
  BAND_COUNT,
  BOARD_MARGIN,
  BOARD_SCALE,
  HEIGHT,
  PITCH,
  SKEW_X,
  SQUEEZE_X,
  TEXT_ROWS,
  TILT_DEG,
  WIDTH,
} from "./constants";

export interface Mat {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** m applied after n. */
const mul = (m: Mat, n: Mat): Mat => ({
  a: m.a * n.a + m.c * n.b,
  b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d,
  d: m.b * n.c + m.d * n.d,
  e: m.a * n.e + m.c * n.f + m.e,
  f: m.b * n.e + m.d * n.f + m.f,
});

const invert = (m: Mat): Mat => {
  const det = m.a * m.d - m.b * m.c;
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
};

const apply = (m: Mat, x: number, y: number) => ({
  x: m.a * x + m.c * y + m.e,
  y: m.b * x + m.d * y + m.f,
});

const theta = (TILT_DEG * Math.PI) / 180;
const cos = Math.cos(theta);
const sin = Math.sin(theta);

const rotate: Mat = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
const scale: Mat = {
  a: BOARD_SCALE * SQUEEZE_X,
  b: 0,
  c: 0,
  d: BOARD_SCALE,
  e: 0,
  f: 0,
};
const shear: Mat = { a: 1, b: 0, c: SKEW_X, d: 1, e: 0, f: 0 };

/**
 * Board origin (0,0) is the panel's centre and lands at the frame centre.
 * Rotate ∘ (squeeze + scale) ∘ shear.
 */
export const BOARD_TO_SCREEN: Mat = mul(
  { a: 1, b: 0, c: 0, d: 1, e: WIDTH / 2, f: HEIGHT / 2 },
  mul(rotate, mul(scale, shear)),
);

// How much board plane the frame actually sees: pull the four screen corners
// back through the inverse and take their bounding box.
const inv = invert(BOARD_TO_SCREEN);
const corners = [
  apply(inv, 0, 0),
  apply(inv, WIDTH, 0),
  apply(inv, WIDTH, HEIGHT),
  apply(inv, 0, HEIGHT),
];
const xs = corners.map((p) => p.x);
const ys = corners.map((p) => p.y);

export const BOARD_X0 = Math.min.apply(null, xs) - BOARD_MARGIN;
export const BOARD_X1 = Math.max.apply(null, xs) + BOARD_MARGIN;
export const BOARD_W = BOARD_X1 - BOARD_X0;

const boardH =
  Math.max.apply(null, ys) - Math.min.apply(null, ys) + 2 * BOARD_MARGIN;

/** Lattice rows per band, sized so BAND_COUNT bands cover the visible plane. */
export const ROWS_PER_BAND = Math.ceil(Math.ceil(boardH / PITCH) / BAND_COUNT);
export const TOTAL_ROWS = ROWS_PER_BAND * BAND_COUNT;

/** Top of lattice row 0, centred on the board origin. */
export const GRID_Y0 = -(TOTAL_ROWS * PITCH) / 2;
export const BAND_H = ROWS_PER_BAND * PITCH;

/**
 * Row 0 of every band is its separator rule; the content sprite sits below,
 * roughly centred in what is left.
 */
export const TEXT_ROW_OFFSET = Math.max(
  2,
  Math.round((ROWS_PER_BAND - TEXT_ROWS) / 2) - 1,
);

export const bandTop = (index: number) => GRID_Y0 + index * BAND_H;
