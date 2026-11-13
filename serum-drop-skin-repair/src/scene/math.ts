export type Vec3 = [number, number, number];

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
export const smoother = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
/** 0 before a, 1 after b, smooth in between */
export const ramp = (x: number, a: number, b: number) =>
  smooth((x - a) / (b - a));

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const normalize = norm;

/** sRGB (0-255) -> linear float triplet */
export const srgb = (r: number, g: number, b: number): number[] =>
  [r, g, b].map((v) => Math.pow(v / 255, 2.2));

/** scale a colour */
export const mul = (c: number[], k: number): number[] => c.map((v) => v * k);

export type CameraKey = {
  f: number;
  pos: Vec3;
  target: Vec3;
  roll?: number; // degrees
  fov?: number; // vertical, degrees
};

export type CameraState = {
  pos: Vec3;
  target: Vec3;
  roll: number;
  fov: number;
};

/**
 * Smooth curve through scalar keyframes [frame, value] with arbitrary spacing
 * (cubic Hermite, finite-difference tangents => C1 continuous, no stutter).
 */
export const curve = (keys: [number, number][], frame: number): number => {
  const n = keys.length;
  if (frame <= keys[0][0]) return keys[0][1];
  if (frame >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && frame >= keys[i + 1][0]) i++;
  const [f1, v1] = keys[i];
  const [f2, v2] = keys[i + 1];
  const slope = (j: number) => {
    const a = keys[Math.max(j - 1, 0)];
    const b = keys[Math.min(j + 1, n - 1)];
    return b[0] === a[0] ? 0 : (b[1] - a[1]) / (b[0] - a[0]);
  };
  const h = f2 - f1;
  const t = (frame - f1) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * v1 +
    (t3 - 2 * t2 + t) * h * slope(i) +
    (-2 * t3 + 3 * t2) * v2 +
    (t3 - t2) * h * slope(i + 1)
  );
};

export const sampleCamera = (keys: CameraKey[], frame: number): CameraState => {
  const c = (get: (k: CameraKey) => number) =>
    curve(
      keys.map((k) => [k.f, get(k)] as [number, number]),
      frame,
    );
  return {
    pos: [c((k) => k.pos[0]), c((k) => k.pos[1]), c((k) => k.pos[2])],
    target: [
      c((k) => k.target[0]),
      c((k) => k.target[1]),
      c((k) => k.target[2]),
    ],
    roll: c((k) => k.roll ?? 0),
    fov: c((k) => k.fov ?? 30),
  };
};

/** Column-major mat3 [right, up, -forward] for the shader's camera basis */
export const cameraMatrix = (cam: CameraState): Float32Array => {
  const f = norm(sub(cam.target, cam.pos));
  let r = norm(cross(f, [0, 1, 0]));
  let u = cross(r, f);
  const a = (cam.roll * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const r2: Vec3 = [
    r[0] * ca + u[0] * sa,
    r[1] * ca + u[1] * sa,
    r[2] * ca + u[2] * sa,
  ];
  const u2: Vec3 = [
    u[0] * ca - r[0] * sa,
    u[1] * ca - r[1] * sa,
    u[2] * ca - r[2] * sa,
  ];
  r = r2;
  u = u2;
  return new Float32Array([
    r[0], r[1], r[2],
    u[0], u[1], u[2],
    -f[0], -f[1], -f[2],
  ]);
};

export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
