import {
  BufferGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  ShapeGeometry,
  Vector2,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BAR, COIN_THICK } from "../lib/objects";

/**
 * Unit coin (radius 1) as a lathe around +Y. Profile, from the centre of the
 * top face outwards and back in along the bottom: recessed field, one raised
 * emboss ring, raised rim, rounded outer corner, reeded edge.
 */
const coinProfile = () => {
  const h = COIN_THICK / 2;
  const field = h - 0.032;
  const ring = h - 0.012;
  const top: [number, number][] = [
    [0.0, field],
    [0.3, field],
    [0.5, field],
    [0.515, ring - 0.004],
    [0.53, ring],
    [0.575, ring],
    [0.59, ring - 0.004],
    [0.605, field],
    [0.8, field],
    [0.83, field + 0.004],
    [0.845, h - 0.006],
    [0.86, h],
    [0.955, h],
    [0.985, h - 0.01],
    [1.0, h - 0.03],
  ];
  // Edge band (reeded) between top[last] and its mirror.
  const bottom = [...top].reverse().map(([r, y]) => [r, -y] as [number, number]);
  const pts = [...top, ...bottom].map(([r, y]) => new Vector2(r, y));
  // LatheGeometry wants the profile ordered so the surface faces outward:
  // three revolves points around Y; going from top centre to bottom centre
  // with increasing then decreasing radius gives outward normals when reversed.
  pts.reverse();
  const n = pts.length;
  // v of a profile point i is i / (n - 1). Edge band: the two r = 1 points.
  const edgeA = pts.findIndex((p) => p.x === 1.0);
  const edgeV: [number, number] = [edgeA / (n - 1), (edgeA + 1) / (n - 1)];
  return { pts, edgeV };
};

const profile = coinProfile();
export const COIN_EDGE_V = profile.edgeV;

export const makeCoinGeometry = (segments = 96): BufferGeometry => {
  const g = new LatheGeometry(profile.pts, segments);
  // Lay the coin flat in XY? No: keep axis = +Y; instance rotation does the rest.
  return g;
};

/** Classic trapezoid ingot: rounded box, top face tapered in. Exact normals. */
export const makeBarGeometry = (): BufferGeometry => {
  const { length, width, height, taper, radius } = BAR;
  const g = new RoundedBoxGeometry(length, height, width, 4, radius);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  // x' = x*s(y), z' = z*s(y), s(y) = a + b*y (s = 1 at bottom, taper at top).
  const b = (taper - 1) / height;
  const a = 1 + b * (height / 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const s = a + b * y;
    pos.setXYZ(i, x * s, y, z * s);
    // Normals transform by the inverse transpose of the Jacobian.
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    const tx = nx / s;
    const ty = (-x * b * nx) / s + ny - (z * b * nz) / s;
    const tz = nz / s;
    const l = Math.hypot(tx, ty, tz);
    nor.setXYZ(i, tx / l, ty / l, tz / l);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
};

export const roundedRectShape = (w: number, h: number, r: number) => {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

/** Flat face with UVs 0..1 across the rectangle (ShapeGeometry uses raw xy). */
export const makeFaceGeometry = (w: number, h: number, r: number, curveSegments = 24) => {
  const g = new ShapeGeometry(roundedRectShape(w, h, r), curveSegments);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  }
  uv.needsUpdate = true;
  return g;
};

/** Card body (edge + caps) centred on z = 0, thickness t, tiny bevel. */
export const makeCardBodyGeometry = (w: number, h: number, r: number, t: number) => {
  const bevel = 0.012;
  const g = new ExtrudeGeometry(roundedRectShape(w - 2 * bevel, h - 2 * bevel, r - bevel), {
    depth: t - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 24,
  });
  g.translate(0, 0, -(t - 2 * bevel) / 2);
  return g;
};
