export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t: number) => Math.pow(clamp(t), 3);

/**
 * Smooth (C1) interpolation through time-stamped keys using cubic Hermite
 * segments with Catmull-Rom style tangents. Tangents at the ends are zero so
 * motion eases in/out of the first and last key.
 */
export type Key = { t: number; v: number[] };
export const spline = (keys: Key[], t: number): number[] => {
  if (t <= keys[0].t) return keys[0].v.slice();
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v.slice();
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[i];
  const k1 = keys[i + 1];
  const dt = k1.t - k0.t;
  const u = (t - k0.t) / dt;
  const tangent = (j: number, c: number) => {
    if (j <= 0 || j >= keys.length - 1) return 0;
    const a = keys[j - 1];
    const b = keys[j + 1];
    return (b.v[c] - a.v[c]) / (b.t - a.t);
  };
  const h00 = 2 * u * u * u - 3 * u * u + 1;
  const h10 = u * u * u - 2 * u * u + u;
  const h01 = -2 * u * u * u + 3 * u * u;
  const h11 = u * u * u - u * u;
  return k0.v.map(
    (_, c) =>
      h00 * k0.v[c] + h10 * dt * tangent(i, c) + h01 * k1.v[c] + h11 * dt * tangent(i + 1, c),
  );
};

export type CameraPose = { pos: V3; target: V3; roll: number; fov: number };

export type Camera = {
  pos: V3;
  right: V3;
  up: V3;
  fwd: V3;
  f: number;
  cx: number;
  cy: number;
};

export const makeCamera = (pose: CameraPose, width: number, height: number): Camera => {
  const fwd = norm(sub(pose.target, pose.pos));
  const r0 = norm(cross(fwd, [0, 1, 0]));
  const u0 = cross(r0, fwd);
  const c = Math.cos(pose.roll);
  const s = Math.sin(pose.roll);
  const right: V3 = [r0[0] * c + u0[0] * s, r0[1] * c + u0[1] * s, r0[2] * c + u0[2] * s];
  const up: V3 = [u0[0] * c - r0[0] * s, u0[1] * c - r0[1] * s, u0[2] * c - r0[2] * s];
  const f = height / 2 / Math.tan(((pose.fov * Math.PI) / 180) / 2);
  return { pos: pose.pos, right, up, fwd, f, cx: width / 2, cy: height / 2 };
};

/** Projected point: screen x/y in pixels, z = depth along the view axis. */
export type Proj = { x: number; y: number; z: number };

export const project = (cam: Camera, p: V3, out: Proj): boolean => {
  const dx = p[0] - cam.pos[0];
  const dy = p[1] - cam.pos[1];
  const dz = p[2] - cam.pos[2];
  const z = dx * cam.fwd[0] + dy * cam.fwd[1] + dz * cam.fwd[2];
  if (z < 0.05) return false;
  const x = dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2];
  const y = dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2];
  out.x = cam.cx + (cam.f * x) / z;
  out.y = cam.cy - (cam.f * y) / z;
  out.z = z;
  return true;
};
