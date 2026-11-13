import { clamp } from "./rng";

/**
 * A camera key. The camera sits at polar position (yaw, dist) around the chip
 * at height h and looks at (lx, ly, lz). All angles in degrees.
 */
export type CamKey = {
  t: number;
  yaw: number;
  dist: number;
  h: number;
  ly: number;
  lx?: number;
  lz?: number;
  roll: number;
  fov: number;
  /** focus distance; <=0 means "distance to the look-at point" */
  focus: number;
  /** depth-of-field strength */
  aperture: number;
};

export type CamState = {
  pos: [number, number, number];
  look: [number, number, number];
  roll: number;
  fov: number;
  focus: number;
  aperture: number;
};

const CHANNELS = ["yaw", "dist", "h", "ly", "lx", "lz", "roll", "fov", "focus", "aperture"] as const;

/** Monotone-ish Catmull-Rom (Hermite with clamped finite-difference tangents). */
const sample = (keys: CamKey[], ch: (typeof CHANNELS)[number], t: number) => {
  const v = (i: number) => (keys[clamp(i, 0, keys.length - 1)][ch] ?? 0) as number;
  const T = (i: number) => keys[clamp(i, 0, keys.length - 1)].t;
  if (t <= keys[0].t) return v(0);
  if (t >= keys[keys.length - 1].t) return v(keys.length - 1);
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const t0 = T(i);
  const t1 = T(i + 1);
  const dt = t1 - t0;
  const u = (t - t0) / dt;
  const slope = (a: number, b: number) => (T(b) === T(a) ? 0 : (v(b) - v(a)) / (T(b) - T(a)));
  const tangent = (k: number) => {
    if (k <= 0 || k >= keys.length - 1) return 0;
    const s0 = slope(k - 1, k);
    const s1 = slope(k, k + 1);
    if (s0 * s1 <= 0) return 0;
    // harmonic mean keeps the curve from overshooting
    return (2 * s0 * s1) / (s0 + s1);
  };
  const m0 = tangent(i) * dt;
  const m1 = tangent(i + 1) * dt;
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * v(i) +
    (u3 - 2 * u2 + u) * m0 +
    (-2 * u3 + 3 * u2) * v(i + 1) +
    (u3 - u2) * m1
  );
};

const posOf = (key: CamKey): [number, number, number] => {
  const yaw = (key.yaw * Math.PI) / 180;
  return [Math.sin(yaw) * key.dist, key.h, Math.cos(yaw) * key.dist];
};

/**
 * Keys with focus <= 0 mean "focus on the look-at point". Resolve those to real
 * distances first, so that the focus channel interpolates between distances
 * (never through the 0 sentinel) and focus pulls stay continuous.
 */
const resolved = new WeakMap<CamKey[], CamKey[]>();
const resolveFocus = (keys: CamKey[]): CamKey[] => {
  let r = resolved.get(keys);
  if (!r) {
    r = keys.map((key) => {
      if (key.focus > 0) return key;
      const p = posOf(key);
      return { ...key, focus: Math.hypot(p[0] - (key.lx ?? 0), p[1] - Math.max(key.ly, 0), p[2] - (key.lz ?? 0)) };
    });
    resolved.set(keys, r);
  }
  return r;
};

export const evalCamera = (rawKeys: CamKey[], t: number): CamState => {
  const keys = resolveFocus(rawKeys);
  const g = (ch: (typeof CHANNELS)[number]) => sample(keys, ch, t);
  const yaw = (g("yaw") * Math.PI) / 180;
  const d = g("dist");
  const pos: [number, number, number] = [Math.sin(yaw) * d, g("h"), Math.cos(yaw) * d];
  const look: [number, number, number] = [g("lx"), g("ly"), g("lz")];
  const focus = Math.max(g("focus"), 0.2);
  return { pos, look, roll: (g("roll") * Math.PI) / 180, fov: g("fov"), focus, aperture: g("aperture") };
};

const k = (
  t: number,
  yaw: number,
  dist: number,
  h: number,
  ly: number,
  roll: number,
  fov: number,
  focus: number,
  aperture: number,
  lz = 0,
  lx = 0,
): CamKey => ({ t, yaw, dist, h, ly, roll, fov, focus, aperture, lz, lx });

/**
 * CPU clip, reference move: skim low over the board, bank towards the socket
 * as the die drops in, then crane up into a near top-down hero frame.
 */
export const CAM_CPU_REFERENCE: CamKey[] = [
  k(0.0, -62, 28.0, 0.62, -3.6, 0, 40, 7.0, 1.3),
  k(1.1, -55, 19.0, 0.72, -2.2, -3, 40, 7.5, 1.3),
  k(1.9, -43, 13.0, 2.6, 0.3, -13, 40, 0, 1.25),
  k(2.85, -30, 5.6, 2.5, 0.25, -17, 40, 0, 1.1),
  k(3.9, -24, 7.8, 3.7, 0.1, -10, 38, 0, 1.0),
  k(5.6, -31, 9.8, 6.0, 0.0, -4, 36, 0, 1.0),
  k(7.6, -17, 8.8, 8.6, 0.0, -1, 35, 0, 1.05, -0.15),
  k(10.1, 0, 6.6, 10.4, 0.0, 0, 35, 0, 1.1, -0.3),
];

/**
 * Padlock clip, reference move: same low skim, then settle into a low frontal
 * hero angle with the hologram centred above the chip.
 */
export const CAM_LOCK_REFERENCE: CamKey[] = [
  k(0.0, -62, 27.0, 0.62, -3.6, 0, 40, 5.0, 1.5),
  k(0.9, -55, 17.5, 0.75, -2.0, -3, 40, 5.5, 1.5),
  k(1.7, -43, 10.4, 2.2, 0.4, -11, 40, 0, 1.25),
  k(2.6, -31, 6.6, 2.9, 0.6, -14, 40, 0, 1.1),
  k(3.6, -24, 6.2, 3.5, 0.8, -9, 39, 0, 1.05),
  k(5.0, -17, 6.9, 4.1, 1.0, -5, 38, 0, 1.05),
  k(6.4, -10, 7.3, 3.7, 1.25, -2, 37, 0, 1.05),
  k(8.0, -3, 7.6, 2.6, 1.4, 0, 36, 0, 1.1),
  k(10.1, 0, 7.6, 2.1, 1.45, 0, 36, 0, 1.1),
];

/**
 * Padlock clip, alternative move: start as a rotating bird's-eye view, spiral
 * down around the socket while the lock materialises and finish on a slow
 * three-quarter orbit (the lock is turned to face this camera).
 */
export const CAM_LOCK_ORBIT: CamKey[] = [
  k(0.0, 205, 3.0, 21.0, 0.0, 0, 40, 0, 0.9),
  k(1.2, 170, 5.0, 15.5, 0.0, 0, 40, 0, 0.9),
  k(2.3, 128, 8.0, 9.0, 0.3, 0, 40, 0, 0.95),
  k(3.6, 92, 8.6, 5.2, 0.8, 0, 39, 0, 1.0),
  k(5.2, 62, 8.2, 3.8, 1.2, 0, 38, 0, 1.0),
  k(7.2, 44, 7.8, 3.1, 1.4, 0, 37, 0, 0.95),
  k(10.1, 30, 7.4, 2.7, 1.5, 0, 36, 0, 0.95),
];
