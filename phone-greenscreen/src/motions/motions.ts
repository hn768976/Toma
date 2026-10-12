/**
 * Motion curves. Every value is a pure function of the frame number:
 * no clocks, no state carried between frames, no randomness.
 */

export type Pose = {
  position: [number, number, number];
  /** Euler angles in radians, order "YXZ" (yaw, then pitch, then roll) */
  rotation: [number, number, number];
};

export type CameraSpec =
  | {
      kind: "perspective";
      fov: number; // vertical, degrees
      position: [number, number, number];
      target: [number, number, number];
    }
  | { kind: "orthographic"; viewHeight: number };

const deg = Math.PI / 180;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (f: number, a: number, b: number) => clamp01((f - a) / (b - a));

export const easeInCubic = (u: number) => u * u * u;
export const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);
export const easeInOutSine = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);
/** ease-out with a single soft overshoot; s ~ 0.6 gives ~2.5 % overshoot */
export const easeOutBack = (u: number, s: number) =>
  1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);

/** Camera distance so that the 1.5-unit phone fills `fraction` of the frame height. */
const distanceFor = (fraction: number, fov: number) =>
  1.5 / fraction / 2 / Math.tan((fov * deg) / 2);
const halfWidthAt = (distance: number, fov: number, aspect: number) =>
  distance * Math.tan((fov * deg) / 2) * aspect;

const ASPECT = 16 / 9;
const FOV = 22;

// ---------------------------------------------------------------------------
// 1 — Drop In (300 frames)
// ---------------------------------------------------------------------------
const DROP_D = distanceFor(0.74, FOV);
const DROP_X = 0.38 * halfWidthAt(DROP_D, FOV, ASPECT); // centre-right (~69 % across)

export const DROP_IN = {
  camera: {
    kind: "perspective",
    fov: FOV,
    position: [0, 0.32, DROP_D],
    target: [0, 0.02, 0],
  } as CameraSpec,
  floorY: -0.75,
  pose: (f: number): Pose => {
    const baseYaw = 5 * deg; // left side just visible; the hold turns 20° to the left
    const y0 = 0.06;
    const top = 2.95;
    // 0–1.5 s: drop in with a soft ease-out and a small settle bounce
    if (f < 45) {
      const e = easeOutBack(f / 45, 0.75);
      return {
        position: [DROP_X, mix(top, y0, e), 0],
        rotation: [mix(-6 * deg, 0, e), mix(baseYaw + 16 * deg, baseYaw, e), mix(-7 * deg, 0, e)],
      };
    }
    // 1.5–7 s: hold, slowly turning ~20° to the left and back
    if (f < 210) {
      const u = seg(f, 45, 210);
      const turn = 0.5 - 0.5 * Math.cos(2 * Math.PI * u);
      return {
        position: [DROP_X, y0 + 0.012 * Math.sin(2 * Math.PI * u), 0],
        rotation: [0, baseYaw - 20 * deg * turn, 0],
      };
    }
    // 7–8.5 s: tilt slightly and lift out of the top (ease-in)
    const u = seg(f, 210, 255);
    const e = easeInCubic(u);
    const tilt = easeInOutSine(u);
    return {
      position: [DROP_X + 0.08 * e, mix(y0, top, e), 0],
      rotation: [-7 * deg * tilt, baseYaw + 6 * deg * tilt, -9 * deg * tilt],
    };
  },
};

// ---------------------------------------------------------------------------
// 2 — Sway (600-frame loop)
// ---------------------------------------------------------------------------
const SWAY_FOV = 30; // wider lens + closer camera: more perspective taper while it turns
const SWAY_D = distanceFor(0.82, SWAY_FOV);
const SWAY_VH = 1.5 / 0.82;
const SWAY_X = -0.38 * halfWidthAt(SWAY_D, SWAY_FOV, ASPECT); // left third (~31 % across)

export const SWAY = {
  camera: {
    kind: "perspective",
    fov: SWAY_FOV,
    position: [0, 0.1, SWAY_D],
    target: [0, 0, 0],
  } as CameraSpec,
  floorY: -1.2,
  pose: (f: number, loopLength: number): Pose => {
    // wrap so that frame N is exactly frame 0
    const t = (((f % loopLength) + loopLength) % loopLength) / loopLength;
    const TAU = 2 * Math.PI;
    return {
      position: [SWAY_X, -0.005 + 0.02 * SWAY_VH * Math.sin(TAU * 3 * t + 0.6), 0],
      rotation: [
        2 * deg * Math.sin(TAU * 2 * t + 1.9),
        18 * deg * Math.sin(TAU * 2 * t),
        // phase chosen so the phone leans into its first full turn
        6 * deg * Math.sin(TAU * 3 * t - 0.785),
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — Tumble Land (300 frames)
// ---------------------------------------------------------------------------
const TUMBLE_D = distanceFor(0.74, FOV);

export const TUMBLE = {
  camera: {
    kind: "perspective",
    fov: FOV,
    position: [0, 0.35, TUMBLE_D],
    target: [0, 0.02, 0],
  } as CameraSpec,
  floorY: -0.8,
  pose: (f: number): Pose => {
    const top = 3.1;
    const y0 = 0.07;
    const restYaw = -7 * deg;
    // 0–3.5 s: tumble in (≈1.25 turns over two axes), land upright at
    // ~2.5 s and settle by 3.5 s
    if (f < 105) {
      const u = f / 105;
      const y = mix(top, y0, easeOutBack(u, 0.55));
      const r = easeOutBack(seg(f, 0, 100), 0.35);
      return {
        position: [0, y, 0],
        rotation: [
          mix(-24 * deg, 0, r), // pitch
          mix(450 * deg, restYaw, r), // ~1.25 turns of yaw: enters edge-on (90°)
          mix(38 * deg, 0, r), // roll
        ],
      };
    }
    // 3.5–8 s: hold with a very slight float
    if (f < 240) {
      const v = seg(f, 105, 240);
      const fl = 0.5 - 0.5 * Math.cos(2 * Math.PI * v);
      return {
        position: [0, y0 + 0.022 * fl, 0],
        rotation: [0, restYaw + 2.5 * deg * Math.sin(2 * Math.PI * v), 0],
      };
    }
    // 8–10 s: tip and tumble out of the top
    const u = seg(f, 240, 300);
    const e = easeInCubic(u);
    const tip = easeInOutSine(Math.min(1, u * 1.6));
    return {
      position: [0.15 * e, mix(y0, top + 0.3, e), 0],
      rotation: [-50 * deg * tip - 130 * deg * e, restYaw - 110 * deg * e, 16 * deg * tip],
    };
  },
};

// ---------------------------------------------------------------------------
// 4 — Grid (600-frame loop)
// ---------------------------------------------------------------------------
export const GRID = {
  camera: { kind: "orthographic", viewHeight: 2.7 } as CameraSpec,
  columns: 4,
  rowPeriod: 2.1,
  rows: [-3, -2, -1, 0, 1, 2],
  /** upward scroll; exactly one row period per loop, wrapped so frame N === frame 0 */
  offset: (f: number, loopLength: number) => {
    const w = ((f % loopLength) + loopLength) % loopLength;
    return GRID.rowPeriod * (w / loopLength);
  },
};

// ---------------------------------------------------------------------------
// Model check: front, back, three-quarter front, three-quarter back
// ---------------------------------------------------------------------------
const CHECK_D = distanceFor(0.8, FOV);
export const MODEL_CHECK_MOTION = {
  camera: {
    kind: "perspective",
    fov: FOV,
    position: [0, 0.15, CHECK_D],
    target: [0, 0, 0],
  } as CameraSpec,
  pose: (f: number): Pose => {
    const views: [number, number, number][] = [
      [0, 0, 0],
      [0, 180 * deg, 0],
      [-8 * deg, -38 * deg, 0],
      [8 * deg, 142 * deg, 0],
    ];
    return { position: [0, 0, 0], rotation: views[Math.min(f, 3)] };
  },
};
