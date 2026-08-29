import { HEIGHT, PLANE_MARGIN, TILE_U, TILE_V, WIDTH } from "./constants";
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
 * `shear`, then centred on the frame. Parallel lines stay parallel inside the
 * plane — this is a fake, not a projection.
 */
export const matFromPlane = (rot: number, shear: number): Mat => {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return [
    cos,
    sin,
    cos * shear - sin,
    sin * shear + cos,
    WIDTH / 2,
    HEIGHT / 2,
  ];
};

export type Plane = {
  key: string;
  /** local -> screen */
  m: Mat;
  /** screen -> local */
  inv: Mat;
  /** Local-space bounding box of the frame, padded for oversized elements. */
  bbox: { u0: number; u1: number; v0: number; v1: number };
  /** The depth anchor in this plane's local space. Depth radiates from it. */
  vanish: Point;
  /** Local distance from `vanish` at which depth saturates. */
  depthRadius: number;
  /** Wrap-around tile of this plane's content. */
  tileU: number;
  tileV: number;
  /** Relative brightness of this plane's grid. */
  tone: number;
};

/** Widest element half-diagonal, so nothing pops in at the frame edge. */
const ELEMENT_PAD = 520;

/**
 * The depth anchor: the point the depth-of-field radiates from. It sits off
 * centre so the focal band is not a bullseye, and mirrors with the plane.
 */
export const depthAnchor = (
  structure: StructureMode,
  planeMirror: number,
): Point =>
  structure === "wall"
    ? { x: WIDTH / 2, y: HEIGHT / 2 }
    : { x: WIDTH / 2 + planeMirror * 520, y: HEIGHT / 2 - 260 };

/**
 * One plane per spec. Each covers the whole frame — the picture is a single
 * continuous surface, not a set of panels meeting at seams.
 */
export const buildPlanes = (
  structure: StructureMode,
  specs: PlaneSpec[],
  planeMirror: number,
): Plane[] => {
  const o = PLANE_MARGIN;
  const corners: Point[] = [
    { x: -o, y: -o },
    { x: WIDTH + o, y: -o },
    { x: WIDTH + o, y: HEIGHT + o },
    { x: -o, y: HEIGHT + o },
  ];
  const anchor = depthAnchor(structure, planeMirror);

  return specs.map((spec) => {
    const m = matFromPlane(spec.rot * planeMirror, spec.shear * planeMirror);
    const inv = matInvert(m);

    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const p of corners) {
      const l = matApply(inv, p.x, p.y);
      u0 = Math.min(u0, l.x);
      u1 = Math.max(u1, l.x);
      v0 = Math.min(v0, l.y);
      v1 = Math.max(v1, l.y);
    }
    const bbox = {
      u0: u0 - ELEMENT_PAD,
      u1: u1 + ELEMENT_PAD,
      v0: v0 - ELEMENT_PAD,
      v1: v1 + ELEMENT_PAD,
    };

    const vanish = matApply(inv, anchor.x, anchor.y);
    let depthRadius = 0;
    for (const p of corners) {
      const l = matApply(inv, p.x, p.y);
      depthRadius = Math.max(
        depthRadius,
        Math.hypot(l.x - vanish.x, l.y - vanish.y),
      );
    }

    // A static scene has no drift to close, so its content sits on one tile
    // and never repeats. A drifting scene wraps on the distance it covers.
    const single = spec.tile === "frame";
    return {
      key: spec.key,
      m,
      inv,
      bbox,
      vanish,
      depthRadius,
      tileU: single ? bbox.u1 - bbox.u0 : TILE_U,
      tileV: single ? bbox.v1 - bbox.v0 : TILE_V,
      tone: spec.tone,
    };
  });
};

/** Distance, as a fraction of depthRadius, at which the plane is in focus. */
const FOCAL_T = 0.24;
/** How much further out the plane takes to reach full foreground blur. */
const NEAR_SPAN = 0.5;

/**
 * Depth proxy, 0 at the depth anchor and 1 in the near foreground. The focal
 * band sits a third of the way out and the foreground saturates well before
 * the plane's far corner, so a real share of the frame is soft at both ends.
 */
export const depthAt = (plane: Plane, u: number, v: number): number => {
  const t =
    Math.hypot(u - plane.vanish.x, v - plane.vanish.y) / plane.depthRadius;
  if (t < FOCAL_T) return (t / FOCAL_T) * 0.5;
  return 0.5 + Math.min(1, (t - FOCAL_T) / NEAR_SPAN) * 0.5;
};

/**
 * Opacity falls off into the distance and softens again in the foreground.
 * `dimming` scales how much of that falloff applies: elements floating in
 * front of a flat surface have no distance to fade into.
 */
export const depthOpacity = (d: number, dimming: number): number => {
  const full = d < 0.5 ? 0.62 + (d / 0.5) * 0.38 : 1 - ((d - 0.5) / 0.5) * 0.22;
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
  // [far, mid, near], a tent peaking on the focal band.
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

/** Sets a buffer's transform to a plane's local space, honouring buffer scale. */
export const setPlaneTransform = (
  ctx: CanvasRenderingContext2D,
  res: number,
  m: Mat,
): void => {
  ctx.setTransform(
    m[0] * res,
    m[1] * res,
    m[2] * res,
    m[3] * res,
    m[4] * res,
    m[5] * res,
  );
};
