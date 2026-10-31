import * as THREE from "three";

export const DEG = Math.PI / 180;

/** Unit-sphere position for a latitude/longitude, matching THREE.SphereGeometry UVs
 *  (u = 0 at lon -180, equirectangular textures). */
export const latLonToVec3 = (lat: number, lon: number, r = 1, out = new THREE.Vector3()) => {
  const la = lat * DEG;
  const lo = lon * DEG;
  return out.set(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);
};

/** Great-circle angle between two lat/lon points (radians). */
export const angularDistance = (a: [number, number], b: [number, number]) =>
  latLonToVec3(a[0], a[1]).angleTo(latLonToVec3(b[0], b[1]));

/** Deterministic PRNG (mulberry32). */
export const mulberry32 = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));

export type Key = { t: number; v: number[] };

/**
 * Smooth, non-uniform cubic Hermite spline through keyframes (Catmull-Rom style
 * tangents scaled for uneven spacing). Gives continuous velocity between keys.
 */
export const sampleTrack = (keys: Key[], t: number): number[] => {
  if (t <= keys[0].t) return keys[0].v.slice();
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v.slice();
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(keys.length - 1, i + 2)];
  const h = k2.t - k1.t;
  const u = (t - k1.t) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return k1.v.map((_, j) => {
    const m1 = k0 === k1 ? (k2.v[j] - k1.v[j]) / h : (k2.v[j] - k0.v[j]) / (k2.t - k0.t);
    const m2 = k3 === k2 ? (k2.v[j] - k1.v[j]) / h : (k3.v[j] - k1.v[j]) / (k3.t - k1.t);
    return h00 * k1.v[j] + h10 * h * m1 + h01 * k2.v[j] + h11 * h * m2;
  });
};
