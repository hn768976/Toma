import type { VariantConfig } from "./variants";

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION = 600;

/** Canvas 2D affine matrix, in `setTransform(a, b, c, d, e, f)` order. */
export type Mat = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

/**
 * Geometry of the single tilted plane every layer is drawn on.
 *
 * Plane space is an ordinary cartesian space centred on (0, 0); the matrix
 * below maps it to screen space. Because the transform is affine, parallel
 * lines stay parallel — at this tilt true perspective would be invisible
 * anyway, and an affine map keeps the layers exactly coplanar.
 */
export type Plane = {
  matrix: Mat;
  det: number;
  /** Column pitch in plane units. */
  colPitch: number;
  /** Row pitch in plane units. */
  rowPitch: number;
  /** Columns in one horizontally repeating tile. */
  tileCols: number;
  /** Rows spanning the full plane height. */
  tileRows: number;
  /** Width of one tile: the exact distance the plane drifts over 600 frames. */
  tileW: number;
  /** Height of the plane. Not tiled — it simply overruns the frame. */
  tileH: number;
  /** Top-left corner of the plane region, in plane units. */
  originX: number;
  originY: number;
};

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * Rotate · Shear · VerticalScale, composed once.
 *
 *   shear:  x' = x + k·y
 *   scale:  y' = sy·y
 *   rotate: standard 2×2
 */
const tiltMatrix = (config: VariantConfig): Mat => {
  const { rotationDeg, shear, verticalScale: sy } = config.tilt;
  const cos = Math.cos(deg(rotationDeg));
  const sin = Math.sin(deg(rotationDeg));
  return {
    a: cos,
    b: sin,
    c: sy * (cos * shear - sin),
    d: sy * (sin * shear + cos),
    e: WIDTH / 2,
    f: HEIGHT / 2,
  };
};

export const buildPlane = (config: VariantConfig): Plane => {
  const matrix = tiltMatrix(config);
  const { a, b, c, d } = matrix;
  const det = a * d - b * c;

  // Pull the four screen corners back into plane space to learn how much of
  // the plane the frame actually covers.
  const inv = (x: number, y: number) => ({
    x: (d * x - c * y) / det,
    y: (-b * x + a * y) / det,
  });
  const corners = [
    inv(-WIDTH / 2, -HEIGHT / 2),
    inv(WIDTH / 2, -HEIGHT / 2),
    inv(-WIDTH / 2, HEIGHT / 2),
    inv(WIDTH / 2, HEIGHT / 2),
  ];
  const spanX = 2 * Math.max(...corners.map((p) => Math.abs(p.x)));
  const spanY = 2 * Math.max(...corners.map((p) => Math.abs(p.y)));

  // Pitch is chosen so that a horizontal screen line crosses `columns` columns
  // and a vertical screen line crosses `rows` rows — which is what "roughly
  // 14 × 20 visible" means to someone looking at the frame.
  const colPitch = ((d / det) * WIDTH) / config.grid.columns;
  const rowPitch = ((a / det) * HEIGHT) / config.grid.rows;

  // One extra column of bleed horizontally (the tile repeats), two extra rows
  // vertically (it does not), so no edge of the plane can ever enter frame.
  const tileCols = Math.ceil(spanX / colPitch) + 1;
  const tileRows = Math.ceil(spanY / rowPitch) + 2;
  const tileW = tileCols * colPitch;
  const tileH = tileRows * rowPitch;

  return {
    matrix,
    det,
    colPitch,
    rowPitch,
    tileCols,
    tileRows,
    tileW,
    tileH,
    originX: -tileW / 2,
    originY: -tileH / 2,
  };
};

/** Progress through the loop, in [0, 1). Frame 600 folds back onto frame 0. */
export const loopT = (frame: number): number => (frame % DURATION) / DURATION;

/**
 * How far the plane has drifted along its own x axis at this frame. Exactly
 * one tile width over the 600-frame cycle, so the loop closes.
 */
export const driftX = (frame: number, plane: Plane): number =>
  -loopT(frame) * plane.tileW;

/**
 * The starting x of the first tile copy, always in (-1.5·tileW, -0.5·tileW],
 * so that copies at k = 0, 1, 2 always cover the frame.
 */
export const tileBaseX = (frame: number, plane: Plane): number => {
  const d = driftX(frame, plane);
  const wrapped = d - Math.floor(d / plane.tileW) * plane.tileW; // [0, tileW)
  return plane.originX + wrapped - plane.tileW;
};

export const TILE_COPIES = [0, 1, 2];

/** ±10px ambient camera move on a closed Lissajous path. */
export const ambient = (frame: number): { x: number; y: number } => {
  const t = loopT(frame) * Math.PI * 2;
  return { x: 10 * Math.sin(t), y: 10 * Math.sin(2 * t + Math.PI / 3) };
};

/** Applies the plane transform plus this frame's ambient drift to a context. */
export const setPlaneTransform = (
  ctx: CanvasRenderingContext2D,
  plane: Plane,
  frame: number,
) => {
  const { a, b, c, d, e, f } = plane.matrix;
  const amb = ambient(frame);
  ctx.setTransform(a, b, c, d, e + amb.x, f + amb.y);
};
