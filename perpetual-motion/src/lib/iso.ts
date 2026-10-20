// The camera is anatomy's own (`src/kit/iso-kit.ts`, copied unchanged from the
// pinned kit). These helpers add what video needs: an affine "face" matrix for
// any plane in the world, so flat parts can turn in their own plane with
// `transform = isoFace · rotate(θ)`, never a screen-space rotate().
import { iso, type Point3, type Projection } from "../kit/iso-kit.ts";

export type { Point3, Projection };
export { iso };

export type Vec2 = [number, number];
/** SVG matrix(a b c d e f): x' = a·x + c·y + e, y' = b·x + d·y + f */
export type Affine = [number, number, number, number, number, number];

const sub2 = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];

export function screenVector(P: Projection, v: Point3): Vec2 {
  return sub2(iso(v, P), iso([0, 0, 0], P));
}

/**
 * A plane through `origin` spanned by world directions `u` (flat +x) and `v`
 * (flat +y, SVG's "down"). Flat point (a, b) lands on world origin + a·u + b·v.
 */
export interface Face {
  origin: Point3;
  u: Point3;
  v: Point3;
  /** unit normal pointing toward the viewer's side: u × v orientation */
  axis: Point3;
}

export function faceOf(origin: Point3, u: Point3, v: Point3): Face {
  const axis: Point3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return { origin, u, v, axis };
}

/** Wheel on an axle along world x, seen on its +x face. Flat +x = world −y, flat +y = world −z. */
export const faceX = (origin: Point3) => faceOf(origin, [0, -1, 0], [0, 0, -1]);
/** Wheel on an axle along world y, seen on its +y face. Flat +x = world +x, flat +y = world −z. */
export const faceY = (origin: Point3) => faceOf(origin, [1, 0, 0], [0, 0, -1]);

export function faceAffine(P: Projection, face: Face, along = 0): Affine {
  const o = iso([face.origin[0] + face.axis[0] * along, face.origin[1] + face.axis[1] * along, face.origin[2] + face.axis[2] * along], P);
  const u = screenVector(P, face.u);
  const v = screenVector(P, face.v);
  return [u[0], u[1], v[0], v[1], o[0], o[1]];
}

const f4 = (n: number) => {
  const t = n.toFixed(4);
  return t === "-0.0000" ? "0" : t.replace(/\.?0+$/, "");
};

export const matrixText = (m: Affine) => `matrix(${m.map(f4).join(" ")})`;

/** The transform a part turning by `degrees` in its own plane receives. */
export function inPlane(P: Projection, face: Face, degrees: number, along = 0) {
  return `${matrixText(faceAffine(P, face, along))} rotate(${f4(degrees)})`;
}

/** Map a flat point of a face to the screen (same maths the SVG transform does). */
export function flatToScreen(P: Projection, face: Face, [a, b]: Vec2, along = 0): Vec2 {
  const m = faceAffine(P, face, along);
  return [m[0] * a + m[2] * b + m[4], m[1] * a + m[3] * b + m[5]];
}

export function flatToWorld(face: Face, [a, b]: Vec2, along = 0): Point3 {
  return [
    face.origin[0] + face.u[0] * a + face.v[0] * b + face.axis[0] * along,
    face.origin[1] + face.u[1] * a + face.v[1] * b + face.axis[1] * along,
    face.origin[2] + face.u[2] * a + face.v[2] * b + face.axis[2] * along,
  ];
}

export const rot2 = ([x, y]: Vec2, degrees: number): Vec2 => {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
};

export const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

export function polyPath(points: Vec2[], closed = true) {
  if (!points.length) return "";
  return points.map(([x, y], i) => `${i ? "L" : "M"}${fmt(x)} ${fmt(y)}`).join("") + (closed ? "Z" : "");
}

/** Ellipse (as a path) of a circle of radius r lying in a face, centred at flat point c. */
export function faceCirclePath(P: Projection, face: Face, c: Vec2, r: number, along = 0, steps = 48) {
  const pts: Vec2[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push(flatToScreen(P, face, [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)], along));
  }
  return polyPath(pts);
}

/** Screen radius of a sphere of world radius r (orthographic: a circle). */
export function sphereRadius(P: Projection, r: number) {
  const v = screenVector(P, [0, 0, r]);
  // the vertical axis is foreshortened by cos(elevation); a sphere's outline is not
  const elevation = ((P.elevation ?? 30) * Math.PI) / 180;
  return Math.hypot(v[0], v[1]) / Math.cos(elevation);
}

export const TAU = Math.PI * 2;
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
