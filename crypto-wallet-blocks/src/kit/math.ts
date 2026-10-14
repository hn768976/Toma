// Pure helpers. Nothing here reads a clock or Math.random().

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const remap = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeInQuad = (t: number) => clamp01(t) * clamp01(t);
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export const v3lerp = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const v3add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const v3scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

export const bezier = (p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
};

// Rotation matrix columns for Euler angles in three.js "XYZ" order.
export const eulerAxes = (r: V3): [V3, V3, V3] => {
  const [a, b, c] = r;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  // M = Rx(a) * Ry(b) * Rz(c); columns are the cube's local axes in world space.
  return [
    [cb * cc, ca * sc + sa * sb * cc, sa * sc - ca * sb * cc],
    [-cb * sc, ca * cc - sa * sb * sc, sa * cc + ca * sb * sc],
    [sb, -sa * cb, ca * cb],
  ];
};

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Separating-axis test for two oriented boxes with half-extents ha and hb.
export const boxesIntersect = (pa: V3, ra: V3, ha: V3, pb: V3, rb: V3, hb: V3) => {
  const d: V3 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
  const reach = Math.hypot(...ha) + Math.hypot(...hb);
  if (dot(d, d) > reach * reach) return false;
  const A = eulerAxes(ra);
  const B = eulerAxes(rb);
  const axes: V3[] = [...A, ...B];
  for (const a of A) for (const b of B) {
    const c = cross(a, b);
    if (dot(c, c) > 1e-8) axes.push(c);
  }
  for (const L of axes) {
    const proj = (X: [V3, V3, V3], h: V3) => h[0] * Math.abs(dot(X[0], L)) + h[1] * Math.abs(dot(X[1], L)) + h[2] * Math.abs(dot(X[2], L));
    if (Math.abs(dot(d, L)) > proj(A, ha) + proj(B, hb)) return false;
  }
  return true;
};

// Two equal cubes (edge `size`), with a small safety gap.
export const cubesIntersect = (pa: V3, ra: V3, pb: V3, rb: V3, size: number, gap = 0.01) => {
  const h = size / 2 + gap / 2;
  return boxesIntersect(pa, ra, [h, h, h], pb, rb, [h, h, h]);
};
