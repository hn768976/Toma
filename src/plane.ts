import { CONFIG, HEIGHT, WIDTH } from './config';

/** 2D affine matrix in canvas order: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Mat = [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** Returns A·B — i.e. apply B first, then A. */
export const mul = (A: Mat, B: Mat): Mat => [
  A[0] * B[0] + A[2] * B[1],
  A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3],
  A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4],
  A[1] * B[4] + A[3] * B[5] + A[5],
];

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
export const scaleM = (x: number, y: number): Mat => [x, 0, 0, y, 0, 0];
export const shearM = (kx: number): Mat => [1, 0, kx, 1, 0, 0];
export const rotate = (deg: number): Mat => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};

export const apply = (m: Mat, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/**
 * The one transform every element in the scene inherits.
 *
 * Rotation + horizontal shear + a small x squeeze. Parallel lines stay
 * parallel — this is deliberately not a perspective projection; at this blur
 * level the difference is invisible and a real projection would fight the
 * prebaked buffers.
 *
 * The whole thing is anchored on `focus` (the country's centre) so the camera
 * push-in scales about the silhouette rather than about frame centre.
 */
export const planeMatrix = ({
  focus,
  scale,
  drift,
  res,
}: {
  focus: [number, number];
  scale: number;
  drift: [number, number];
  res: number;
}): Mat => {
  const [fx, fy] = focus;
  let m = scaleM(res, res);
  m = mul(m, translate(fx + drift[0], fy + drift[1]));
  m = mul(m, rotate(CONFIG.tiltDeg));
  m = mul(m, shearM(CONFIG.shearX));
  m = mul(m, scaleM(CONFIG.squeezeX * scale, scale));
  m = mul(m, translate(-fx, -fy));
  return m;
};

export const setMat = (ctx: CanvasRenderingContext2D, m: Mat) =>
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);

/** Extent of the plane in frame coordinates, padded so rotation never clips. */
export const PLANE = {
  x: -CONFIG.planeMargin,
  y: -CONFIG.planeMargin,
  w: WIDTH + CONFIG.planeMargin * 2,
  h: HEIGHT + CONFIG.planeMargin * 2,
};

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

export const ctx2d = (c: HTMLCanvasElement) => {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return ctx;
};

/** '#RRGGBB' + alpha → 'rgba(...)'. Keeps every hex confined to VARIANTS. */
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/**
 * Blend two palette colours. Returns '#RRGGBB' so the result can be fed back
 * into alpha() — used for marker variation and gradient stops.
 */
export const mix = (hexA: string, hexB: string, t: number) => {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ch = (sh: number) =>
    Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
};

export const FRAME_CENTER: [number, number] = [WIDTH / 2, HEIGHT / 2];
