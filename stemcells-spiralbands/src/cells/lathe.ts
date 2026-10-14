// Membrane of a (possibly dividing) cell as a surface of revolution.
//
// The shape is the smooth union of two spheres on the local x axis, centres
// at +-d, radius ra, blend radius k (polynomial smin). Every cross-section
// is a disc, so the surface is exactly r(x). Each frame we solve r(x) on the
// CPU, resample it at equal arc length, and hand the rings to the vertex
// shader as a uniform array. d = 0 gives a plain sphere; the waist shrinks
// to zero as k -> 0 with the spheres touching, then they separate.
import * as THREE from "three";

export const RINGS = 128;
export const SEGMENTS = 64;

const smin = (a: number, b: number, k: number) => {
  if (k <= 1e-6) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

const sdf = (x: number, r: number, d: number, ra: number, k: number) => {
  const a = Math.hypot(x + d, r) - ra;
  const b = Math.hypot(x - d, r) - ra;
  return smin(a, b, k);
};

export type ProfileParams = { d: number; ra: number; k: number };

const SAMPLES = 360;
const xs = new Float64Array(SAMPLES);
const rs = new Float64Array(SAMPLES);
const arc = new Float64Array(SAMPLES);

const solveR = (x: number, p: ProfileParams) => {
  if (sdf(x, 0, p.d, p.ra, p.k) >= 0) return 0;
  let lo = 0;
  let hi = p.ra + p.k + 0.01;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) * 0.5;
    if (sdf(x, m, p.d, p.ra, p.k) < 0) lo = m;
    else hi = m;
  }
  return (lo + hi) * 0.5;
};

export const tipX = (p: ProfileParams) => {
  let lo = p.d;
  let hi = p.d + p.ra + p.k + 0.01;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) * 0.5;
    if (sdf(m, 0, p.d, p.ra, p.k) < 0) lo = m;
    else hi = m;
  }
  return (lo + hi) * 0.5;
};

/** Fills `out` (RINGS vec4: x, r, nx, nr) with the profile for p. */
export const solveProfile = (p: ProfileParams, out: THREE.Vector4[]) => {
  const tip = tipX(p);
  // Sample x with cosine spacing so the tips (where dr/dx is steep) are dense.
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const x = -tip * Math.cos(Math.PI * t);
    xs[i] = x;
    rs[i] = i === 0 || i === SAMPLES - 1 ? 0 : solveR(x, p);
  }
  arc[0] = 0;
  for (let i = 1; i < SAMPLES; i++) {
    arc[i] = arc[i - 1] + Math.hypot(xs[i] - xs[i - 1], rs[i] - rs[i - 1]);
  }
  const total = arc[SAMPLES - 1];
  let j = 0;
  const e = 1e-4;
  for (let i = 0; i < RINGS; i++) {
    const s = (i / (RINGS - 1)) * total;
    while (j < SAMPLES - 2 && arc[j + 1] < s) j++;
    const f = (s - arc[j]) / Math.max(1e-9, arc[j + 1] - arc[j]);
    const x = xs[j] + (xs[j + 1] - xs[j]) * f;
    let r = rs[j] + (rs[j + 1] - rs[j]) * f;
    if (i === 0 || i === RINGS - 1) r = 0;
    // Normal from the SDF gradient in (x, r).
    const rr = Math.max(r, 2e-4);
    let nx = sdf(x + e, rr, p.d, p.ra, p.k) - sdf(x - e, rr, p.d, p.ra, p.k);
    let nr = sdf(x, rr + e, p.d, p.ra, p.k) - sdf(x, rr - e, p.d, p.ra, p.k);
    if (i === 0) { nx = -1; nr = 0; }
    if (i === RINGS - 1) { nx = 1; nr = 0; }
    const l = Math.hypot(nx, nr) || 1;
    out[i].set(x, r, nx / l, nr / l);
  }
};

/** Neck radius (r at x = 0), handy for tuning the pinch. */
export const neckRadius = (p: ProfileParams) => solveR(0, p);

const latheCache = new Map<string, THREE.BufferGeometry>();

/**
 * Index grid: attribute `ring` (0..RINGS-1) and `theta`. Lower levels of
 * detail use every n-th ring of the same arc-length profile, so the shape is
 * identical; only the tessellation changes.
 */
export const getLatheGeometry = (rings = RINGS, segments = SEGMENTS) => {
  const key = `${rings}x${segments}`;
  const hit = latheCache.get(key);
  if (hit) return hit;
  const count = rings * (segments + 1);
  const ring = new Float32Array(count);
  const theta = new Float32Array(count);
  const position = new Float32Array(count * 3); // placeholder for bounds
  let k = 0;
  for (let i = 0; i < rings; i++) {
    const ri = Math.round((i / (rings - 1)) * (RINGS - 1));
    for (let s = 0; s <= segments; s++) {
      ring[k] = ri;
      theta[k] = (s / segments) * Math.PI * 2;
      k++;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < rings - 1; i++) {
    for (let s = 0; s < segments; s++) {
      const a = i * (segments + 1) + s;
      const b = a + segments + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("ring", new THREE.BufferAttribute(ring, 1));
  g.setAttribute("theta", new THREE.BufferAttribute(theta, 1));
  g.setIndex(index);
  // Generous bounds; culling is done per cell by the engine anyway.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  latheCache.set(key, g);
  return g;
};

/** Levels of detail by radius in impostor texels. */
export const LATHE_LODS = [
  { maxRadius: 45, rings: 40, segments: 28 },
  { maxRadius: 130, rings: 72, segments: 44 },
  { maxRadius: Infinity, rings: RINGS, segments: SEGMENTS },
];
