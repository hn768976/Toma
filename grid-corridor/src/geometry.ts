import {
  HEIGHT,
  PLANE_MARGIN,
  TILE_U,
  TILE_V,
  WIDTH,
} from "./constants";
import type { PlaneSpec, StructureMode } from "./variants";

/** A 2D affine transform, in the same order ctx.setTransform() takes. */
export type Mat = readonly [number, number, number, number, number, number];

export type Point = { x: number; y: number };

export const matApply = (m: Mat, x: number, y: number): Point => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});

export const matInvert = (m: Mat): Mat => {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
};

/**
 * A plane's local axes: rotated by `rot`, then sheared horizontally by
 * `shear`, then dropped at (ox, oy). Parallel lines stay parallel inside a
 * plane — this is a fake, not a projection.
 */
export const matFromPlane = (
  rot: number,
  shear: number,
  ox: number,
  oy: number,
): Mat => {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return [cos, sin, cos * shear - sin, sin * shear + cos, ox, oy];
};

export type Plane = {
  key: string;
  /** local -> screen */
  m: Mat;
  /** screen -> local */
  inv: Mat;
  /** Screen-space clip polygon. Adjacent planes share edges: those are seams. */
  poly: Point[];
  /** Local-space bounding box of the polygon, padded by one tile. */
  bbox: { u0: number; u1: number; v0: number; v1: number };
  /** The vanishing anchor in this plane's local space. Depth radiates from it. */
  vanish: Point;
  /** Local distance from `vanish` at which depth saturates. */
  depthRadius: number;
  /** Wrap-around tile of this plane's content. */
  tileU: number;
  tileV: number;
  /** Relative brightness, so adjacent surfaces separate at the seam. */
  tone: number;
};

const bboxOfLocalPoly = (poly: Point[], inv: Mat, padU: number, padV: number) => {
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const p of poly) {
    const l = matApply(inv, p.x, p.y);
    u0 = Math.min(u0, l.x);
    u1 = Math.max(u1, l.x);
    v0 = Math.min(v0, l.y);
    v1 = Math.max(v1, l.y);
  }
  return { u0: u0 - padU, u1: u1 + padU, v0: v0 - padV, v1: v1 + padV };
};

/**
 * The vanishing anchor. The four corridor planes are the four triangles
 * between the frame corners and this point, so the seams between them are the
 * corners of the space. Mirroring moves it to the other side of frame.
 */
export const vanishPoint = (planeMirror: number): Point => ({
  x: WIDTH / 2 + planeMirror * 560,
  y: HEIGHT / 2 - 310,
});

export const buildPlanes = (
  structure: StructureMode,
  specs: PlaneSpec[],
  planeMirror: number,
): Plane[] => {
  if (structure === "wall") {
    // One flat front plane: no rotation, no shear, one tile wide so nothing
    // repeats. It only exists to carry the floating diagrams and node dots.
    const pad = PLANE_MARGIN * 2;
    const poly: Point[] = [
      { x: -pad, y: -pad },
      { x: WIDTH + pad, y: -pad },
      { x: WIDTH + pad, y: HEIGHT + pad },
      { x: -pad, y: HEIGHT + pad },
    ];
    const m = matFromPlane(0, 0, 0, 0);
    const inv = matInvert(m);
    const bbox = bboxOfLocalPoly(poly, inv, 0, 0);
    return [
      {
        key: "front",
        m,
        inv,
        poly,
        bbox,
        vanish: { x: WIDTH / 2, y: HEIGHT / 2 },
        depthRadius: Math.hypot(WIDTH, HEIGHT) * 0.5,
        tileU: bbox.u1 - bbox.u0,
        tileV: bbox.v1 - bbox.v0,
        tone: 1,
      },
    ];
  }

  const v = vanishPoint(planeMirror);
  const o = PLANE_MARGIN;
  const corners: Point[] = [
    { x: -o, y: -o },
    { x: WIDTH + o, y: -o },
    { x: WIDTH + o, y: HEIGHT + o },
    { x: -o, y: HEIGHT + o },
  ];
  // ceiling / right / floor / left, in the same order as the specs.
  const polys: Point[][] = [
    [corners[0], corners[1], v],
    [corners[1], corners[2], v],
    [corners[2], corners[3], v],
    [corners[3], corners[0], v],
  ];

  return specs.map((spec, i) => {
    const poly = polys[i];
    const centroid = {
      x: (poly[0].x + poly[1].x + poly[2].x) / 3,
      y: (poly[0].y + poly[1].y + poly[2].y) / 3,
    };
    const m = matFromPlane(
      spec.rot * planeMirror,
      spec.shear * planeMirror,
      centroid.x,
      centroid.y,
    );
    const inv = matInvert(m);
    const bbox = bboxOfLocalPoly(poly, inv, TILE_U * 0.5, TILE_V * 0.5);
    const vanish = matApply(inv, v.x, v.y);
    let depthRadius = 0;
    for (const p of poly) {
      const l = matApply(inv, p.x, p.y);
      depthRadius = Math.max(depthRadius, Math.hypot(l.x - vanish.x, l.y - vanish.y));
    }
    return {
      key: spec.key,
      m,
      inv,
      poly,
      bbox,
      vanish,
      depthRadius,
      tileU: TILE_U,
      tileV: TILE_V,
      tone: spec.tone,
    };
  });
};

/**
 * Depth proxy, 0 at the vanishing anchor and 1 at the near corner of the
 * plane. Drives blur bucket, opacity and how bright the grid is.
 */
export const depthAt = (plane: Plane, u: number, v: number): number => {
  const t = Math.hypot(u - plane.vanish.x, v - plane.vanish.y) / plane.depthRadius;
  // The focal band sits a third of the way out, and the foreground saturates
  // well before the plane's far corner, so a real share of the frame is soft
  // at both ends rather than only at two extreme points.
  if (t < FOCAL_T) return (t / FOCAL_T) * 0.5;
  return 0.5 + Math.min(1, (t - FOCAL_T) / NEAR_SPAN) * 0.5;
};

/** Distance, as a fraction of depthRadius, at which the plane is in focus. */
const FOCAL_T = 0.35;
/** How much further out the plane takes to reach full foreground blur. */
const NEAR_SPAN = 0.4;

/**
 * Opacity falls off into the distance and softens again in the foreground.
 * `dimming` scales how much of that falloff applies: elements floating in
 * front of a flat surface have no distance to fade into.
 */
export const depthOpacity = (d: number, dimming: number): number => {
  const full = d < 0.5 ? 0.3 + (d / 0.5) * 0.7 : 1 - ((d - 0.5) / 0.5) * 0.22;
  return 1 + dimming * (full - 1);
};

/**
 * Spreads an element across the depth-of-field buffers. The weights sum to 1
 * and slide continuously, so an element drifting through the focal band
 * cross-dissolves between buffers instead of popping.
 */
export const bucketWeights = (d: number, count: number): number[] => {
  if (count === 2) {
    // "wall" mode: [flat, near]. Floating elements never go fully sharp.
    const t = 0.35 + 0.65 * d;
    return [1 - t, t];
  }
  // "corridor" mode: [far, mid, near], a tent peaking on the focal band.
  const x = 2 * d - 1;
  return [Math.max(0, -x), 1 - Math.abs(x), Math.max(0, x)];
};

/**
 * Every wrap-around copy of a torus position that could touch the frame.
 * Culled in screen space, so the tiling never costs more than it draws.
 */
export const tileCopies = (
  plane: Plane,
  u: number,
  v: number,
  screenRadius: number,
): Point[] => {
  const { bbox, tileU, tileV } = plane;
  const out: Point[] = [];
  const i0 = Math.floor((bbox.u0 - u) / tileU);
  const i1 = Math.ceil((bbox.u1 - u) / tileU);
  const j0 = Math.floor((bbox.v0 - v) / tileV);
  const j1 = Math.ceil((bbox.v1 - v) / tileV);
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const cu = u + i * tileU;
      const cv = v + j * tileV;
      const p = matApply(plane.m, cu, cv);
      if (
        p.x < -screenRadius ||
        p.x > WIDTH + screenRadius ||
        p.y < -screenRadius ||
        p.y > HEIGHT + screenRadius
      ) {
        continue;
      }
      out.push({ x: cu, y: cv });
    }
  }
  return out;
};

export const clipToPlane = (ctx: CanvasRenderingContext2D, plane: Plane): void => {
  ctx.beginPath();
  ctx.moveTo(plane.poly[0].x, plane.poly[0].y);
  for (let i = 1; i < plane.poly.length; i++) {
    ctx.lineTo(plane.poly[i].x, plane.poly[i].y);
  }
  ctx.closePath();
  ctx.clip();
};

/** Sets a buffer's transform to a plane's local space, honouring buffer scale. */
export const setPlaneTransform = (
  ctx: CanvasRenderingContext2D,
  res: number,
  m: Mat,
): void => {
  ctx.setTransform(m[0] * res, m[1] * res, m[2] * res, m[3] * res, m[4] * res, m[5] * res);
};
